'use client';

import { useState } from 'react';
import { Button, Upload, message, Space, Alert, theme } from 'antd';
import { DownloadOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';

import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';
import { useDevZoneFeature } from '@/contexts/DevZoneContext';

interface ExcelImportSectionProps {
  awardType: string;
  templateEndpoint: string;
  importEndpoint: string;
  templateFileName: string;
  onImportSuccess?: (result: any) => void;
  selectedCount?: number;
  selectedPersonnelIds?: (string | number)[];
  entityLabel?: string;
  localProcessing?: boolean;
  onLocalProcess?: (file: File) => Promise<any>;
  previewEndpoint?: string;
  reviewPath?: string;
  sessionStorageKey?: string;
}

export default function ExcelImportSection({
  awardType,
  templateEndpoint,
  importEndpoint,
  templateFileName,
  onImportSuccess,
  selectedCount = 0,
  selectedPersonnelIds = [],
  entityLabel = 'bản ghi',
  localProcessing = false,
  onLocalProcess,
  previewEndpoint,
  reviewPath = '/admin/awards/bulk/import-review',
  sessionStorageKey = 'importPreviewData',
}: ExcelImportSectionProps) {
  const allowImport = useDevZoneFeature(awardType);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const { token } = theme.useToken();

  const handleDownloadTemplate = async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedPersonnelIds.length > 0) {
        params.personnel_ids = selectedPersonnelIds.join(',');
      }
      const response = await axiosInstance.get(templateEndpoint, {
        responseType: 'blob',
        params,
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
      const errorMsg = error.response?.data?.message || error.message || 'Tải file mẫu thất bại';
      message.error(errorMsg);
    }
  };

  const handleUploadExcel = async (file: File) => {
    // Reset success state for new upload
    setImportSuccess(false);
    setImportedCount(0);

    // Preview mode: upload to preview endpoint and navigate to review page
    if (previewEndpoint) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploading(true);
        const response = await axiosInstance.post(previewEndpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const data = response.data?.data || response.data;
        sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));

        message.success('Đã phân tích file Excel. Đang chuyển đến trang xem trước...');
        router.push(reviewPath);
        return true;
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.message || error.message || 'Phân tích file thất bại';
        message.error(errorMsg);
        return false;
      } finally {
        setUploading(false);
      }
    }

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


        return true;
      } catch (error: any) {
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

  
          return true;
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Import thất bại';
        message.error(errorMsg);
        return false;
      } finally {
        setUploading(false);
      }
    }
  };

  if (!allowImport) return null;

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
            {selectedPersonnelIds.length > 0
              ? ` (${selectedPersonnelIds.length} ${entityLabel})`
              : ''}
          </Button>

          <Upload
            showUploadList={false}
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
