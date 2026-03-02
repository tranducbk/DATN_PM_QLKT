// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Alert,
  Breadcrumb,
  Upload,
  message,
  Row,
  Col,
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  HomeOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import type { UploadProps } from 'antd';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

export default function PersonnelImportPage() {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileSelect = (file: File) => {
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.name.endsWith('.xlsx')
    ) {
      setSelectedFile(file);
      setImportResult(null);
      return false; // Prevent auto upload
    } else {
      message.error('Vui lòng chọn file Excel (.xlsx)');
      return false;
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const result = await apiClient.importPersonnel(selectedFile);

      if (result.success) {
        setImportResult(result.data);
        message.success('Import dữ liệu quân nhân thành công');
      } else {
        message.error(result.message || 'Có lỗi xảy ra khi import dữ liệu');
      }
    } catch (error: any) {
      message.error(error.message || 'Có lỗi xảy ra khi import dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      setLoading(true);
      const blob = await apiClient.exportPersonnelSample();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mau_quan_nhan.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Tải file mẫu thành công');
    } catch (error: any) {
      message.error(error.message || 'Có lỗi xảy ra khi tải file mẫu');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: handleFileSelect,
    onRemove: handleRemoveFile,
    fileList: selectedFile ? [{ uid: '1', name: selectedFile.name, status: 'done' }] : [],
    accept: '.xlsx',
    maxCount: 1,
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
        <Breadcrumb.Item>Import dữ liệu</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 8 }}>
          <Link href="/admin/personnel">
            <Button icon={<LeftOutlined />}>Quay lại</Button>
          </Link>
        </Space>
        <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
          Import dữ liệu Quân nhân
        </Title>
        <Paragraph style={{ fontSize: 14, color: '#666', marginBottom: 0 }}>
          Import dữ liệu quân nhân từ file Excel
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Import Section */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UploadOutlined />
                <span>Upload file Excel</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* File Upload Area */}
              <Dragger {...uploadProps} style={{ padding: '20px' }}>
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
                  Chọn file Excel
                </p>
                <p className="ant-upload-hint" style={{ color: '#666' }}>
                  Kéo thả file hoặc click để chọn
                </p>
              </Dragger>

              {selectedFile && (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleImport}
                  loading={loading}
                  block
                  size="large"
                >
                  {loading ? 'Đang import...' : 'Import dữ liệu'}
                </Button>
              )}

              {/* Import Instructions */}
              <Alert
                icon={<ExclamationCircleOutlined />}
                message={
                  <div>
                    <Text strong>Yêu cầu file:</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                      <li>Định dạng: .xlsx (Excel 2007+)</li>
                      <li>Cột bắt buộc: CCCD, Họ tên, Mã đơn vị, Tên chức vụ</li>
                      <li>Dữ liệu bắt đầu từ dòng 2 (dòng 1 là header)</li>
                    </ul>
                  </div>
                }
                type="info"
                showIcon
              />
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
              Chọn file Excel chứa dữ liệu quân nhân để import
            </Paragraph>
          </Card>
        </Col>

        {/* Sample Template Section */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                <span>File mẫu</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Alert
                icon={<CheckCircleOutlined />}
                message={
                  <div>
                    <Text strong>File mẫu bao gồm:</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                      <li>Các cột bắt buộc với tên chính xác</li>
                      <li>Ví dụ dữ liệu mẫu</li>
                      <li>Hướng dẫn định dạng</li>
                    </ul>
                  </div>
                }
                type="success"
                showIcon
              />

              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadSample}
                loading={loading}
                block
                size="large"
              >
                {loading ? 'Đang tải...' : 'Tải file mẫu'}
              </Button>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
              Tải file Excel mẫu để tham khảo định dạng
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* Import Results */}
      {importResult && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>Kết quả import</span>
            </Space>
          }
          style={{ marginTop: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card
                style={{
                  textAlign: 'center',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
                  {importResult.created || 0}
                </div>
                <div style={{ color: '#52c41a', marginTop: 8 }}>Tạo mới</div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{
                  textAlign: 'center',
                  backgroundColor: '#e6f7ff',
                  border: '1px solid #91d5ff',
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                  {importResult.updated || 0}
                </div>
                <div style={{ color: '#1890ff', marginTop: 8 }}>Cập nhật</div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{
                  textAlign: 'center',
                  backgroundColor: '#fff2e8',
                  border: '1px solid #ffbb96',
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa541c' }}>
                  {importResult.errors?.length || 0}
                </div>
                <div style={{ color: '#fa541c', marginTop: 8 }}>Lỗi</div>
              </Card>
            </Col>
          </Row>

          {importResult.errors && importResult.errors.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ color: '#ff4d4f', marginBottom: 16 }}>
                Chi tiết lỗi:
              </Title>
              <div
                style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {importResult.errors.map((error: any, index: number) => (
                  <Alert
                    key={index}
                    message={`Dòng ${error.row}: ${error.message}`}
                    type="error"
                    showIcon
                    style={{ marginBottom: 0 }}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
