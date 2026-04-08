'use client';

import { useState } from 'react';
import { Button, Upload, message, Space, Alert, theme, Divider, Modal, InputNumber, List, Typography } from 'antd';
import { DownloadOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';

const { Text } = Typography;

import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/apiError';
import { useDevZoneFeature } from '@/contexts/DevZoneContext';

interface ExcelImportSectionProps {
  awardType: string;
  downloadTemplate: (params: Record<string, string>) => Promise<Blob>;
  importFile: (file: File) => Promise<any>;
  templateFileName: string;
  onImportSuccess?: (result: any) => void;
  selectedPersonnelIds?: string[];
  selectedNames?: string[];
  entityLabel?: string;
  localProcessing?: boolean;
  onLocalProcess?: (file: File) => Promise<any>;
  previewImport?: (file: File) => Promise<any>;
  reviewPath?: string;
  sessionStorageKey?: string;
}

export function ExcelImportSection({
  awardType,
  downloadTemplate,
  importFile,
  templateFileName,
  onImportSuccess,
  selectedPersonnelIds = [],
  selectedNames = [],
  entityLabel = 'bản ghi',
  localProcessing = false,
  onLocalProcess,
  previewImport,
  reviewPath = '/admin/awards/bulk/import-review',
  sessionStorageKey = 'importPreviewData',
}: ExcelImportSectionProps) {
  const allowImport = useDevZoneFeature(awardType);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [repeatMap, setRepeatMap] = useState<Record<string, number>>({});
  const { token } = theme.useToken();

  const handleDownloadTemplate = async () => {
    setTemplateModalVisible(false);
    try {
      const params: Record<string, string> = {};
      if (selectedPersonnelIds.length > 0) {
        params.personnel_ids = selectedPersonnelIds.join(',');
      }
      const hasCustomRepeat = Object.values(repeatMap).some(v => v > 1);
      if (hasCustomRepeat) {
        params.repeat_map = JSON.stringify(repeatMap);
      }
      const blob = await downloadTemplate(params);

      // Check if response is actually a blob
      if (!(blob instanceof Blob)) {
        throw new Error('Response is not a valid file');
      }

      const url = window.URL.createObjectURL(new Blob([blob]));
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
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Tải file mẫu thất bại'));
    }
  };

  const handleUploadExcel = async (file: File) => {
    // Reset success state for new upload
    setImportSuccess(false);
    setImportedCount(0);

    // Preview mode: upload to preview endpoint and navigate to review page
    if (previewImport) {
      try {
        setUploading(true);
        const response = await previewImport(file);

        const data = response?.data;
        try {
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
        } catch (storageError) {
          if (storageError instanceof DOMException && storageError.name === 'QuotaExceededError') {
            message.error('Dữ liệu xem trước quá lớn. Vui lòng giảm số lượng dòng trong file Excel.');
            return false;
          }
          throw storageError;
        }

        message.success('Đã phân tích file Excel. Đang chuyển đến trang xem trước...');
        router.push(reviewPath);
        return true;
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Phân tích file thất bại'));
        return false;
      } finally {
        setUploading(false);
      }
    }

    if (localProcessing && onLocalProcess) {
      try {
        setUploading(true);
        const result = await onLocalProcess(file);

        message.success(`Đã thêm thành công ${result.imported}/${result.total} ${entityLabel}`);

        // Show at most 5 errors to avoid overwhelming the user
        if (result.errors && result.errors.length > 0) {
          const displayErrors = result.errors.slice(0, 5);
          displayErrors.forEach((error: string) => {
            message.warning(error, 3);
          });

          if (result.errors.length > 5) {
            message.info(`Còn ${result.errors.length - 5} lỗi khác...`, 3);
          }
        }

        setImportSuccess(true);
        setImportedCount(result.imported);

        if (onImportSuccess) {
          onImportSuccess(result);
        }


        return true;
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Xử lý file thất bại'));
        return false;
      } finally {
        setUploading(false);
      }
    } else {
      try {
        setUploading(true);
        const response = await importFile(file);

        if (response.success) {
          const result = response.data;
          message.success(`Đã thêm thành công ${result.imported}/${result.total} ${entityLabel}`);

          // Show at most 5 errors to avoid overwhelming the user
          if (result.errors && result.errors.length > 0) {
            const displayErrors = result.errors.slice(0, 5);
            displayErrors.forEach((error: string) => {
              message.warning(error, 3);
            });

            if (result.errors.length > 5) {
              message.info(`Còn ${result.errors.length - 5} lỗi khác...`, 3);
            }
          }

          setImportSuccess(true);
          setImportedCount(result.imported);

          if (onImportSuccess) {
            onImportSuccess(result);
          }

  
          return true;
        }

        message.error(response.message || 'Import thất bại');
        return false;
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Import thất bại'));
        return false;
      } finally {
        setUploading(false);
      }
    }
  };

  if (!allowImport) return null;

  return (
    <>
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
              {selectedPersonnelIds.length === 0
                ? `Chọn ít nhất 1 ${entityLabel} từ danh sách bên dưới trước, sau đó tải file mẫu để điền thông tin`
                : `Tải file mẫu (${selectedPersonnelIds.length} ${entityLabel} đã chọn), điền thông tin và upload để tự động điền dữ liệu`}
            </span>
          </div>
        </div>

        <Space size="middle">
          <Button
            icon={<DownloadOutlined />}
            onClick={() => { setRepeatMap({}); setTemplateModalVisible(true); }}
            size="large"
            disabled={selectedPersonnelIds.length === 0}
          >
            Tải file mẫu Excel
            {selectedPersonnelIds.length > 0
              ? ` (${selectedPersonnelIds.length} ${entityLabel})`
              : ''}
          </Button>

          <Upload
            showUploadList={false}
            beforeUpload={file => {
              if (file.size > 10 * 1024 * 1024) {
                message.error('File quá lớn. Tối đa 10MB.');
                return false;
              }

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
            message={`Đã thêm thành công ${importedCount} ${entityLabel} từ file Excel`}
            type="success"
            showIcon
          />
        )}
      </Space>
    </div>
    <Divider>Hoặc chọn thủ công</Divider>

    <Modal
      title="Tải file mẫu Excel"
      open={templateModalVisible}
      onCancel={() => setTemplateModalVisible(false)}
      onOk={handleDownloadTemplate}
      okText="Tải file mẫu"
      cancelText="Huỷ"
      centered
      width={500}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Text type="secondary">Nhập số dòng cho mỗi {entityLabel} trong file Excel. Mặc định là 1.</Text>
        <List
          size="small"
          bordered
          style={{ maxHeight: 400, overflow: 'auto' }}
          dataSource={selectedPersonnelIds.map((id, i) => ({
            id: String(id),
            name: selectedNames[i] || `${entityLabel} ${i + 1}`,
          }))}
          renderItem={(item, index) => (
            <List.Item style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>{index + 1}. {item.name}</Text>
              <InputNumber
                min={1}
                max={20}
                value={repeatMap[item.id] || 1}
                onChange={val => setRepeatMap(prev => ({ ...prev, [item.id]: val || 1 }))}
                size="small"
                style={{ width: 60 }}
              />
            </List.Item>
          )}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tổng số dòng: {selectedPersonnelIds.reduce((sum, id) => sum + (repeatMap[String(id)] || 1), 0)}
        </Text>
      </Space>
    </Modal>
    </>
  );
}
