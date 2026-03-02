'use client';

import { useState } from 'react';
import { Button, Upload, message, Space, Alert, theme } from 'antd';
import { DownloadOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import axiosInstance from '@/utils/axiosInstance';

interface ExcelImportSectionProps {
  templateEndpoint: string;
  importEndpoint: string;
  templateFileName: string;
  onImportSuccess?: (result: any) => void;
  selectedCount?: number;
  entityLabel?: string; // 'quân nhân', 'đơn vị', etc.
  localProcessing?: boolean; // Nếu true, xử lý file local thay vì gửi lên server
  onLocalProcess?: (file: File) => Promise<any>; // Hàm xử lý local
}

export default function ExcelImportSection({
  templateEndpoint,
  importEndpoint,
  templateFileName,
  onImportSuccess,
  selectedCount = 0,
  entityLabel = 'bản ghi',
  localProcessing = false,
  onLocalProcess,
}: ExcelImportSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const { token } = theme.useToken();

  const handleDownloadTemplate = async () => {
    try {
      const response = await axiosInstance.get(templateEndpoint, {
        responseType: 'blob',
      });

      // Check if response is actually a blob
      if (!(response.data instanceof Blob)) {
        throw new Error('Response is not a valid file');
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${templateFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Tải file mẫu thành công');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Tải file mẫu thất bại';
      message.error(errorMsg);
    }
  };

  const handleUploadExcel = async (file: File) => {
    // Reset success state for new upload
    setImportSuccess(false);
    setImportedCount(0);

    if (localProcessing && onLocalProcess) {
      // Xử lý local
      try {
        setUploading(true);
        const result = await onLocalProcess(file);

        message.success(`Đã thêm thành công ${result.imported}/${result.total} ${entityLabel}`);

        // Hiển thị lỗi nếu có (tối đa 5 lỗi đầu tiên)
        if (result.errors && result.errors.length > 0) {
          const displayErrors = result.errors.slice(0, 5);
          displayErrors.forEach((error: string) => {
            message.warning(error, 3);
          });

          if (result.errors.length > 5) {
            message.info(`Còn ${result.errors.length - 5} lỗi khác...`, 3);
          }
        }

        // Set success state
        setImportSuccess(true);
        setImportedCount(result.imported);

        // Callback với result
        if (onImportSuccess) {
          onImportSuccess(result);
        }

        setFileList([]);
        return true;
      } catch (error: any) {
        console.error('Error processing Excel locally:', error);
        const errorMsg = error.message || 'Xử lý file thất bại';
        message.error(errorMsg);
        return false;
      } finally {
        setUploading(false);
      }
    } else {
      // Xử lý server như cũ
      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploading(true);
        const response = await axiosInstance.post(importEndpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          const result = response.data.data;
          message.success(`Đã thêm thành công ${result.imported}/${result.total} ${entityLabel}`);

          // Hiển thị lỗi nếu có (tối đa 5 lỗi đầu tiên)
          if (result.errors && result.errors.length > 0) {
            const displayErrors = result.errors.slice(0, 5);
            displayErrors.forEach((error: string) => {
              message.warning(error, 3);
            });

            if (result.errors.length > 5) {
              message.info(`Còn ${result.errors.length - 5} lỗi khác...`, 3);
            }
          }

          // Set success state
          setImportSuccess(true);
          setImportedCount(result.imported);

          // Callback với result
          if (onImportSuccess) {
            onImportSuccess(result);
          }

          setFileList([]);
          return true;
        }
      } catch (error: any) {
        console.error('Error importing Excel:', error);
        const errorMsg = error.response?.data?.message || 'Import thất bại';
        message.error(errorMsg);
        return false;
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        background: token.colorPrimaryBg,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorPrimaryBorder}`,
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CloudUploadOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 16, color: token.colorText }}>
              Import nhanh từ file Excel
            </strong>
            <br />
            <span style={{ color: token.colorTextSecondary }}>
              Tải file mẫu, điền thông tin và upload để tự động điền dữ liệu
            </span>
          </div>
        </div>

        <Space size="middle">
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} size="large">
            Tải file mẫu Excel
          </Button>

          <Upload
            fileList={fileList}
            beforeUpload={file => {
              const isExcel =
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel';

              if (!isExcel) {
                message.error('Chỉ được upload file Excel (.xlsx, .xls)');
                return false;
              }

              handleUploadExcel(file);
              return false;
            }}
            onChange={({ fileList }) => setFileList(fileList)}
            maxCount={1}
            accept=".xlsx,.xls"
          >
            <Button icon={<UploadOutlined />} loading={uploading} size="large" type="primary">
              {uploading ? 'Đang upload...' : 'Upload file Excel'}
            </Button>
          </Upload>
        </Space>

        {importSuccess && importedCount > 0 && (
          <Alert
            message={`Đã Đã thêm thành công ${importedCount} ${entityLabel} từ file Excel`}
            type="success"
            showIcon
          />
        )}
      </Space>
    </div>
  );
}
