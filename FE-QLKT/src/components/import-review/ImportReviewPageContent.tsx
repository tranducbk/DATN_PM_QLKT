'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Alert,
  Space,
  Typography,
  Breadcrumb,
  Spin,
  message,
  Result,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  HistoryOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DANH_HIEU_MAP } from '@/constants/danhHieu.constants';
import { getApiErrorMessage, logApiError } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE, DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';

const { Title, Text } = Typography;

export interface PreviewItem {
  row?: number;
  personnel_id?: string;
  unit_id?: string;
  ho_ten?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ma_don_vi?: string;
  ten_don_vi?: string;
  nam?: number;
  danh_hieu?: string;
  loai?: string;
  mo_ta?: string;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
  so_quyet_dinh?: string;
  so_quyet_dinh_bkbqp?: string;
  so_quyet_dinh_cstdtq?: string;
  so_quyet_dinh_bkttcp?: string;
  ghi_chu?: string;
  history?: Record<string, any>[];
  message?: string;
  error?: string;
  errors?: string[];
  __key?: number;
  [key: string]: any;
}

export interface DanhHieuColorMap {
  [key: string]: string;
}

export interface ImportReviewConfig {
  sessionStorageKey: string;
  title: string;
  confirmImport: (items: any[]) => Promise<any>;
  successMessage: (count: number) => string;
  confirmButtonLabel: string;
  validColumns: ColumnsType<PreviewItem>;
  invalidColumns: ColumnsType<PreviewItem>;
  historyColumns: ColumnsType<Record<string, any>>;
  breadcrumbLastItem?: string;
  historyLabel?: string;
  noHistoryLabel?: string;
}

export function BooleanIcon({ value }: { value: boolean | undefined }) {
  return value ? (
    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
  ) : (
    <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
  );
}

export const renderText = (val: string) => val ?? '';

const FALLBACK_ERROR = 'Lỗi không xác định';

export function getDanhHieuTag(danhHieu: string | undefined, colorMap: DanhHieuColorMap = {}) {
  if (!danhHieu) return <Tag>--</Tag>;
  const label = DANH_HIEU_MAP[danhHieu] ?? danhHieu;
  const color = colorMap[danhHieu] ?? 'default';
  return <Tag color={color}>{label}</Tag>;
}

export function makeErrorColumn(): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Lỗi',
    key: 'error',
    width: 500,
    render: (_: unknown, record: any) => {
      const errorText = record.message ?? record.error ?? FALLBACK_ERROR;
      return <Text type="danger">{errorText}</Text>;
    },
  };
}

export function makeSTTColumn(width = 60): ColumnsType<PreviewItem>[number] {
  return {
    key: 'stt',
    title: 'STT',
    width,
    align: 'center' as const,
    render: (_: unknown, __: any, index: number) => index + 1,
  };
}

export function makeRowNumberColumn(): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Dòng',
    dataIndex: 'row',
    width: 60,
    align: 'center' as const,
    render: (val: number) => val ?? '--',
  };
}

export function makeHoTenColumn(width = 180, withRender = false): ColumnsType<PreviewItem>[number] {
  const col = {
    title: 'Họ tên',
    dataIndex: 'ho_ten',
    width,
    ellipsis: true,
  };
  return withRender ? { ...col, render: renderText } : col;
}

export function makeNamColumn(width = 80, withRender = false): ColumnsType<PreviewItem>[number] {
  const col = {
    title: 'Năm',
    dataIndex: 'nam',
    width,
    align: 'center' as const,
  };
  return withRender ? { ...col, render: (val: number) => val ?? '' } : col;
}

export function makeSoQDColumn(width = 140): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Số QĐ',
    dataIndex: 'so_quyet_dinh',
    width,
    ellipsis: true,
    render: renderText,
  };
}

export function makeGhiChuColumn(width = 150): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Ghi chú',
    dataIndex: 'ghi_chu',
    width,
    ellipsis: true,
    render: renderText,
  };
}

export function makeCapBacColumn(): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Cấp bậc',
    dataIndex: 'cap_bac',
    width: 120,
    ellipsis: true,
  };
}

export function makeChucVuColumn(): ColumnsType<PreviewItem>[number] {
  return {
    title: 'Chức vụ',
    dataIndex: 'chuc_vu',
    width: 150,
    ellipsis: true,
  };
}

export function ImportReviewPageContent({ config }: { config: ImportReviewConfig }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [previewData, setPreviewData] = useState<{
    valid: PreviewItem[];
    invalid: PreviewItem[];
  } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [validPagination, setValidPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [invalidPagination, setInvalidPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(config.sessionStorageKey);
      if (raw) {
        const data = JSON.parse(raw);
        const validRaw: PreviewItem[] = data.valid ?? [];
        const invalidRaw: PreviewItem[] = data.errors ?? [];
        const valid = validRaw.map((item, i) => ({ ...item, __key: i }));
        const invalid = invalidRaw.map((item, i) => ({ ...item, __key: i }));
        setPreviewData({ valid, invalid });
        setSelectedRowKeys(valid.map(v => v.__key as React.Key));
      }
    } catch (error: unknown) {
      logApiError(error, 'đọc dữ liệu xem trước import');
    } finally {
      setLoading(false);
    }
  }, [config.sessionStorageKey]);

  const validCount = previewData?.valid?.length ?? 0;
  const invalidCount = previewData?.invalid?.length ?? 0;
  const totalCount = validCount + invalidCount;
  const selectedCount = selectedRowKeys.length;

  const historyLabel = config.historyLabel ?? 'Lịch sử khen thưởng';
  const noHistoryLabel = config.noHistoryLabel ?? 'Chưa có lịch sử khen thưởng.';
  const breadcrumbLastItem = config.breadcrumbLastItem ?? 'Xem trước dữ liệu tải lên';

  const validColumnsPaginated = useMemo(() => {
    return config.validColumns.map(col => {
      const c = col as ColumnsType<PreviewItem>[number];
      if (c.key === 'stt') {
        return {
          ...c,
          render: (_: unknown, __: PreviewItem, index: number) =>
            (validPagination.current - 1) * validPagination.pageSize + index + 1,
        };
      }
      return col;
    });
  }, [config.validColumns, validPagination.current, validPagination.pageSize]);

  const invalidColumnsPaginated = useMemo(() => {
    return config.invalidColumns.map(col => {
      const c = col as ColumnsType<PreviewItem>[number];
      if (c.key === 'stt') {
        return {
          ...c,
          render: (_: unknown, __: PreviewItem, index: number) =>
            (invalidPagination.current - 1) * invalidPagination.pageSize + index + 1,
        };
      }
      return col;
    });
  }, [config.invalidColumns, invalidPagination.current, invalidPagination.pageSize]);

  const handleConfirm = async () => {
    if (!previewData || selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất một bản ghi để import.');
      return;
    }

    const selectedItems = selectedRowKeys
      .map(key => previewData.valid.find(r => r.__key === key))
      .filter((r): r is PreviewItem => r != null)
      .map(item => {
        const rest = { ...item };
        delete rest.__key;
        return rest;
      });

    try {
      setConfirming(true);
      const result = await config.confirmImport(selectedItems);

      if (result?.success) {
        message.success(config.successMessage(selectedItems.length));
        sessionStorage.removeItem(config.sessionStorageKey);
        router.push('/admin/awards');
      } else {
        message.error(result?.message ?? 'Tải dữ liệu thất bại. Vui lòng thử lại.');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Tải dữ liệu thất bại. Vui lòng thử lại.'));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Spin size="large" tip="Đang tải dữ liệu xem trước..." />
      </div>
    );
  }

  if (!previewData || (validCount === 0 && invalidCount === 0)) {
    return (
      <div style={{ padding: 24 }}>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: (
                <Link href="/admin/dashboard">
                  <HomeOutlined /> Trang chủ
                </Link>
              ),
            },
            { title: <Link href="/admin/awards">Khen thưởng</Link> },
            { title: 'Xem trước dữ liệu tải lên' },
          ]}
        />
        <Result
          status="info"
          title="Không có dữ liệu xem trước"
          subTitle="Vui lòng quay lại và upload file Excel để xem trước dữ liệu import."
          extra={
            <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
              Quay lại
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link href="/admin/dashboard">
                <HomeOutlined /> Trang chủ
              </Link>
            ),
          },
          { title: <Link href="/admin/awards">Khen thưởng</Link> },
          {
            title: <Link href="/admin/awards/bulk/create">Thêm hàng loạt</Link>,
          },
          { title: breadcrumbLastItem },
        ]}
      />

      <Title level={3}>{config.title}</Title>

      <Alert
        style={{ marginBottom: 24 }}
        type={invalidCount > 0 ? 'warning' : 'success'}
        showIcon
        message={
          <Space size="large">
            <Text>
              <Text strong style={{ color: '#52c41a' }}>
                {validCount} hợp lệ
              </Text>
              {invalidCount > 0 && (
                <>
                  ,{' '}
                  <Text strong style={{ color: '#ff4d4f' }}>
                    {invalidCount} lỗi
                  </Text>
                </>
              )}
              {' / '}
              <Text strong>{totalCount} tổng</Text>
            </Text>
          </Space>
        }
        description={
          invalidCount > 0
            ? 'Một số bản ghi có lỗi và sẽ không được import. Vui lòng kiểm tra và sửa trong file Excel nếu cần.'
            : 'Tất cả bản ghi đều hợp lệ và sẵn sàng import.'
        }
      />

      {validCount > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>Dữ liệu hợp lệ ({validCount})</span>
            </Space>
          }
          style={{ marginBottom: 24, borderColor: '#b7eb8f' }}
          styles={{ header: { borderBottom: '2px solid #b7eb8f' } }}
        >
          <Table
            rowKey="__key"
            columns={validColumnsPaginated}
            dataSource={previewData.valid}
            rowSelection={{
              selectedRowKeys,
              onChange: keys => setSelectedRowKeys(keys),
            }}
            expandable={{
              expandedRowRender: record => {
                if (!record.history || record.history.length === 0) {
                  return (
                    <Text type="secondary" italic>
                      {noHistoryLabel}
                    </Text>
                  );
                }
                return (
                  <div style={{ padding: '8px 0' }}>
                    <Space style={{ marginBottom: 8 }}>
                      <HistoryOutlined />
                      <Text strong>{historyLabel}</Text>
                    </Space>
                    <Table
                      rowKey={(_r, i) => `history-${i}`}
                      columns={config.historyColumns}
                      dataSource={record.history}
                      pagination={false}
                      size="small"
                      bordered
                    />
                  </div>
                );
              },
              rowExpandable: record => !!(record.history && record.history.length > 0),
            }}
            pagination={
              validCount > DEFAULT_PAGE_SIZE
                ? {
                    ...DEFAULT_ANTD_TABLE_PAGINATION,
                    current: validPagination.current,
                    pageSize: validPagination.pageSize,
                    total: validCount,
                    showTotal: total => `Tổng ${total} bản ghi`,
                    onChange: (page, pageSize) => {
                      setValidPagination({
                        current: page,
                        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
                      });
                    },
                    onShowSizeChange: (_page, size) => {
                      setValidPagination({ current: 1, pageSize: size });
                    },
                  }
                : false
            }
            scroll={{ x: 1200 }}
            size="middle"
            bordered
          />
        </Card>
      )}

      {invalidCount > 0 && (
        <Card
          title={
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <span>Dữ liệu lỗi ({invalidCount})</span>
            </Space>
          }
          style={{ marginBottom: 24, borderColor: '#ffa39e' }}
          styles={{ header: { borderBottom: '2px solid #ffa39e' } }}
        >
          <Table
            rowKey="__key"
            columns={invalidColumnsPaginated}
            dataSource={previewData.invalid}
            pagination={
              invalidCount > DEFAULT_PAGE_SIZE
                ? {
                    ...DEFAULT_ANTD_TABLE_PAGINATION,
                    current: invalidPagination.current,
                    pageSize: invalidPagination.pageSize,
                    total: invalidCount,
                    showTotal: total => `Tổng ${total} lỗi`,
                    onChange: (page, pageSize) => {
                      setInvalidPagination({
                        current: page,
                        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
                      });
                    },
                    onShowSizeChange: (_page, size) => {
                      setInvalidPagination({ current: 1, pageSize: size });
                    },
                  }
                : false
            }
            scroll={{ x: 1000 }}
            size="middle"
            bordered
          />
        </Card>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} size="large" onClick={() => router.back()}>
          Quay lại
        </Button>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          size="large"
          loading={confirming}
          disabled={selectedCount === 0}
          onClick={handleConfirm}
        >
          {confirming
            ? 'Đang tải dữ liệu...'
            : `Xác nhận import (${selectedCount} ${config.confirmButtonLabel})`}
        </Button>
      </div>
    </div>
  );
}
