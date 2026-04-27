'use client';

import { Button, Space, Typography } from 'antd';
import { FilePdfOutlined, EyeOutlined } from '@ant-design/icons';
import { useTheme } from '@/components/ThemeProvider';
import { previewFileWithApi } from '@/lib/filePreview';
import { formatDateTime } from '@/lib/utils';
import styles from './file-attachment.module.css';

const { Text } = Typography;

interface ServerFile {
  filename: string;
  originalName?: string;
  originalname?: string;
  size?: number;
  uploadedAt?: string;
}

interface LocalFile {
  name: string;
  size?: number;
  originFileObj?: File;
}

interface FileAttachmentListProps {
  files: ServerFile[] | LocalFile[];
  mode: 'server' | 'local';
  emptyText?: string;
}

function isServerFile(file: ServerFile | LocalFile): file is ServerFile {
  return 'filename' in file;
}

function getDisplayName(file: ServerFile | LocalFile): string {
  if (isServerFile(file)) {
    const name = file.originalName || file.originalname || file.filename || '';
    try {
      return name.includes('%') ? decodeURIComponent(name) : name;
    } catch {
      return name;
    }
  }
  return file.name || '';
}

function handleView(file: ServerFile | LocalFile) {
  if (isServerFile(file)) {
    const displayName = file.originalName || file.originalname || file.filename || 'document.pdf';
    previewFileWithApi(`/api/proposals/uploads/${file.filename}`, displayName);
  } else if (file.originFileObj) {
    const url = URL.createObjectURL(file.originFileObj);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function FileAttachmentList({ files, mode, emptyText = 'Không có file đính kèm' }: FileAttachmentListProps) {
  const { isDark } = useTheme();

  if (!files || files.length === 0) {
    return <Text type="secondary">{emptyText}</Text>;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {files.map((file, index) => (
        <div
          key={index}
          className={`${styles.fileItem} ${isDark ? styles.fileItemDark : styles.fileItemLight}`}
        >
          <div className={styles.fileContent}>
            <div className={styles.fileHeader}>
              <FilePdfOutlined className={isDark ? styles.fileIconDark : styles.fileIconLight} />
              <Text
                strong
                className={`break-all ${isDark ? styles.fileNameDark : styles.fileNameLight}`}
              >
                {getDisplayName(file)}
              </Text>
            </div>
            <Text
              type="secondary"
              className={`text-xs ${isDark ? styles.fileInfoDark : styles.fileInfoLight}`}
            >
              {file.size ? `Kích thước: ${(file.size / 1024).toFixed(2)} KB` : ''}
              {mode === 'server' && isServerFile(file) && file.uploadedAt
                ? ` \u2022 Ngày tải lên: ${formatDateTime(file.uploadedAt)}`
                : ''}
            </Text>
          </div>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => handleView(file)}
            className={styles.downloadButton}
          >
            Xem file
          </Button>
        </div>
      ))}
    </Space>
  );
}
