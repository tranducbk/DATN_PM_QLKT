'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Breadcrumb,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Pagination,
  Spin,
  Button,
  Popconfirm,
} from 'antd';
import { FileTextOutlined, FundOutlined, HomeOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { LogsFilter, LogsFilterValues } from '@/components/system-logs/LogsFilter';
import { LogsTable, LogEntry } from '@/components/system-logs/LogsTable';
import { apiClient } from '@/lib/apiClient';
import { PAGE_SIZE_OPTIONS } from '@/lib/constants/pagination.constants';
import { useTheme } from '@/components/ThemeProvider';
import { useDevZone } from '@/contexts/DevZoneContext';
import Link from 'next/link';

const { Title, Text } = Typography;

interface PaginationData {
  total: number;
}

/** Raw log entry shape from the API before normalization */
interface RawLogEntry {
  id: string;
  action?: string;
  actor_name?: string;
  actor_id?: string;
  actor_role?: string;
  description?: string;
  details?: string;
  created_at?: string;
  createdAt?: string;
  time?: string;
  timestamp?: string;
  resource?: string;
  resource_id?: string;
  NguoiThucHien?: { QuanNhan?: { ho_ten?: string }; username?: string };
  Actor?: { QuanNhan?: { ho_ten?: string }; username?: string };
}

interface SystemLogsPageContentProps {
  basePath: string; // e.g. '/admin' or '/super-admin'
}

export function SystemLogsPageContent({ basePath }: SystemLogsPageContentProps) {
  const { theme } = useTheme();
  const { features } = useDevZone();
  const allowDeleteLogs = features.allow_delete_logs ?? false;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState<LogsFilterValues>({
    search: '',
    startDate: undefined,
    endDate: undefined,
  });

  const fetchLogs = useCallback(async () => {
    try {
      setTableLoading(true);
      const res = await apiClient.getSystemLogs({
        ...filters,
        page: pagination.current,
        limit: pagination.pageSize,
      });
      // API response may nest data in various shapes; extract safely
      const payload = (res as Record<string, unknown>)?.data ?? res;
      const data = (payload as Record<string, unknown>)?.data || payload;
      const list: RawLogEntry[] = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>)?.logs as RawLogEntry[]) ||
          ((data as Record<string, unknown>)?.items as RawLogEntry[]) ||
          ((data as Record<string, unknown>)?.results as RawLogEntry[]) ||
          [];

      const resObj = res as Record<string, unknown>;
      const paginationInfo = resObj?.pagination as PaginationData | undefined;
      if (paginationInfo) {
        setPagination(prev => ({
          ...prev,
          total: paginationInfo.total || 0,
        }));
      }

      const statsInfo = resObj?.stats as { create?: number; delete?: number; update?: number } | undefined;
      if (statsInfo) {
        setStats({
          create: statsInfo.create || 0,
          del: statsInfo.delete || 0,
          update: statsInfo.update || 0,
        });
      }

      const normalized: LogEntry[] = list.map(l => {
        const actorName =
          l?.NguoiThucHien?.QuanNhan?.ho_ten ||
          l?.NguoiThucHien?.username ||
          l?.actor_name ||
          (l?.actor_role === 'SYSTEM' ? 'Hệ thống' : '') ||
          '';
        return {
          ...l,
          id: l.id,
          action: l?.action?.toUpperCase() || l?.action || '',
          actor_name: actorName,
          actor_role: l?.actor_role || '',
          details: l?.description || l?.details || '',
          description: l?.description || l?.details || '',
          created_at: l?.created_at ?? l?.createdAt ?? l?.time ?? l?.timestamp ?? '',
        };
      });

      setLogs(normalized);
    } catch {
      message.error('Không thể tải nhật ký hệ thống');
      setLogs([]);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const [stats, setStats] = useState({ create: 0, del: 0, update: 0 });

  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) return;
    setDeleting(true);
    try {
      const res = await apiClient.deleteSystemLogs(selectedRowKeys);
      if (res.success) {
        message.success(res.message || `Đã xoá ${selectedRowKeys.length} nhật ký`);
        setSelectedRowKeys([]);
        fetchLogs();
      } else {
        message.error(res.message || 'Xoá thất bại');
      }
    } catch {
      message.error('Xoá thất bại');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  const cardShadow =
    theme === 'dark' ? '0 1px 6px rgba(0, 0, 0, 0.35)' : '0 1px 4px rgba(0, 0, 0, 0.06)';
  const statTextColor = theme === 'dark' ? '#e5e7eb' : '#0f172a';
  const statSubTextColor = theme === 'dark' ? '#cbd5e1' : '#475569';

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item>
            <Link href={`${basePath}/dashboard`}>
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Nhật ký hệ thống</Breadcrumb.Item>
        </Breadcrumb>

        <div style={{ marginBottom: '24px' }}>
          <Title level={1} style={{ margin: 0 }}>
            Nhật ký Hệ thống
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: '4px' }}>
            Xem lịch sử hoạt động và thay đổi trong hệ thống
          </Text>
        </div>

        <LogsFilter onFilterChange={setFilters} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {[
            {
              label: 'Tổng nhật ký',
              value: pagination.total,
              big: true,
              bg: theme === 'dark' ? '#1e3a8a' : '#e6f0ff',
              iconColor: theme === 'dark' ? '#60a5fa' : '#2563eb',
              shadow: theme === 'dark' ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)',
              Icon: FileTextOutlined,
            },
            {
              label: 'Hành động tạo',
              value: stats.create,
              bg: theme === 'dark' ? '#0b3d2e' : '#e8f5e9',
              iconColor: theme === 'dark' ? '#34d399' : '#059669',
              shadow: theme === 'dark' ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)',
              Icon: FundOutlined,
            },
            {
              label: 'Hành động xóa',
              value: stats.del,
              bg: theme === 'dark' ? '#7f1d1d' : '#fee2e2',
              iconColor: theme === 'dark' ? '#f87171' : '#dc2626',
              shadow: theme === 'dark' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
              Icon: FundOutlined,
            },
            {
              label: 'Hành động cập nhật',
              value: stats.update,
              bg: theme === 'dark' ? '#78350f' : '#fef3c7',
              iconColor: theme === 'dark' ? '#fbbf24' : '#d97706',
              shadow: theme === 'dark' ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.2)',
              Icon: FundOutlined,
            },
          ].map(({ label, value, big, bg, iconColor, shadow, Icon }) => (
            <Card
              key={label}
              hoverable
              style={{ borderRadius: '10px', boxShadow: cardShadow, transition: 'all 0.3s ease' }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 1px 3px ${shadow}`,
                  }}
                >
                  <Icon style={{ fontSize: 26, color: iconColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      display: 'block',
                      marginBottom: 4,
                      color: statSubTextColor,
                    }}
                  >
                    {label}
                  </Text>
                  <div
                    style={{
                      fontSize: big ? 32 : 28,
                      fontWeight: 'bold',
                      color: statTextColor,
                      lineHeight: '1.1',
                    }}
                  >
                    {value}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div
            style={{
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Danh sách nhật ký
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: '14px', display: 'block', marginTop: '4px' }}
              >
                Tất cả hoạt động và thay đổi trong hệ thống
              </Text>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchLogs}
                loading={tableLoading}
              >
                Làm mới
              </Button>
            {allowDeleteLogs && (
              <Popconfirm
                title="Xoá nhật ký đã chọn?"
                description={`Bạn có chắc muốn xoá ${selectedRowKeys.length} nhật ký?`}
                onConfirm={handleDeleteSelected}
                okText="Xoá"
                cancelText="Huỷ"
                okButtonProps={{ danger: true }}
                disabled={selectedRowKeys.length === 0}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={selectedRowKeys.length === 0}
                  loading={deleting}
                >
                  Xoá đã chọn ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            </div>
          </div>
          <div style={{ padding: 0 }}>
            <LogsTable
              logs={logs}
              loading={loading || tableLoading}
              selectedRowKeys={allowDeleteLogs ? selectedRowKeys : undefined}
              onSelectionChange={allowDeleteLogs ? setSelectedRowKeys : undefined}
            />
            {pagination.total > 0 && (
              <div
                style={{
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                <Pagination
                  current={pagination.current}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total, range) => `${range[0]}-${range[1]} của ${total} nhật ký`}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onChange={(page, pageSize) => {
                    setTableLoading(true);
                    setPagination(prev => ({
                      ...prev,
                      current: page,
                      pageSize: pageSize || prev.pageSize,
                    }));
                  }}
                  onShowSizeChange={(_current, size) => {
                    setTableLoading(true);
                    setPagination(prev => ({
                      ...prev,
                      current: 1,
                      pageSize: size,
                    }));
                  }}
                />
              </div>
            )}
          </div>
        </Card>
      </div>
    </ConfigProvider>
  );
}
