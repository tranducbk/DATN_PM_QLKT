// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Breadcrumb,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Pagination,
  Spin,
} from 'antd';
import { FileTextOutlined, DashboardOutlined, FundOutlined, HomeOutlined } from '@ant-design/icons';
import { LogsFilter } from '@/components/system-logs/logs-filter';
import { LogsTable } from '@/components/system-logs/logs-table';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/components/theme-provider';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function SystemLogsPage() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    startDate: undefined,
    endDate: undefined,
  });

  // Reset về trang 1 khi filter thay đổi
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [filters]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Chỉ set loading ban đầu, khi chuyển trang thì dùng tableLoading
        if (logs.length === 0) {
          setLoading(true);
        } else {
          setTableLoading(true);
        }
        const res = await apiClient.getSystemLogs({
          ...filters,
          page: pagination.current,
          limit: pagination.pageSize,
        });
        const payload: any = res?.data ?? res;

        // Lấy dữ liệu từ response
        const data = payload?.data || payload;
        const list: any[] = Array.isArray(data)
          ? data
          : data?.logs || data?.items || data?.results || [];

        // Cập nhật pagination từ response
        if (data?.pagination) {
          setPagination(prev => ({
            ...prev,
            total: data.pagination.total || 0,
          }));
        }

        // Chuẩn hóa dữ liệu cho UI
        const normalized = list.map((l: any) => {
          const actorName =
            l?.NguoiThucHien?.QuanNhan?.ho_ten ||
            l?.NguoiThucHien?.username ||
            l?.Actor?.QuanNhan?.ho_ten ||
            l?.Actor?.username ||
            l?.actor_name ||
            l?.actor_id;
          return {
            ...l,
            action: l?.action?.toUpperCase() || l?.action, // Giữ nguyên action từ database
            actor_name: actorName,
            details: l?.description || l?.details || '', // Ưu tiên description từ backend (đã dịch tiếng Việt)
            description: l?.description || l?.details || '', // Đảm bảo có description
            created_at: l?.created_at ?? l?.createdAt ?? l?.time ?? l?.timestamp,
          };
        });

        setLogs(normalized);
      } catch (error) {
        message.error('Không thể tải nhật ký hệ thống');
        setLogs([]);
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    };

    fetchLogs();
  }, [filters, pagination.current, pagination.pageSize]);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item>
            <Link href="/super-admin/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Nhật ký hệ thống</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div>
            <Title level={1} style={{ margin: 0 }}>
              Nhật ký Hệ thống
            </Title>
            <Text type="secondary" style={{ display: 'block', marginTop: '4px' }}>
              Xem lịch sử hoạt động và thay đổi trong hệ thống
            </Text>
          </div>
        </div>

        {/* Filter Section */}
        <LogsFilter onFilterChange={setFilters} />

        {/* Stats Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow:
                theme === 'dark'
                  ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                  : '0 1px 4px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: theme === 'dark' ? '#1e3a8a' : '#e6f0ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    theme === 'dark'
                      ? '0 1px 3px rgba(59, 130, 246, 0.3)'
                      : '0 1px 3px rgba(59, 130, 246, 0.2)',
                }}
              >
                <FileTextOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#60a5fa' : '#2563eb',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: theme === 'dark' ? '#cbd5e1' : '#475569',
                  }}
                >
                  Tổng nhật ký
                </Text>
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                    lineHeight: '1.1',
                  }}
                >
                  {pagination.total}
                </div>
              </div>
            </div>
          </Card>

          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow:
                theme === 'dark'
                  ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                  : '0 1px 4px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: theme === 'dark' ? '#0b3d2e' : '#e8f5e9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    theme === 'dark'
                      ? '0 1px 3px rgba(16, 185, 129, 0.3)'
                      : '0 1px 3px rgba(16, 185, 129, 0.2)',
                }}
              >
                <FundOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#34d399' : '#059669',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: theme === 'dark' ? '#cbd5e1' : '#475569',
                  }}
                >
                  Hành động tạo
                </Text>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                    lineHeight: '1.1',
                  }}
                >
                  {logs.filter(l => l.action?.includes('CREATE')).length}
                </div>
              </div>
            </div>
          </Card>

          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow:
                theme === 'dark'
                  ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                  : '0 1px 4px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: theme === 'dark' ? '#7f1d1d' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    theme === 'dark'
                      ? '0 1px 3px rgba(239, 68, 68, 0.3)'
                      : '0 1px 3px rgba(239, 68, 68, 0.2)',
                }}
              >
                <FundOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#f87171' : '#dc2626',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: theme === 'dark' ? '#cbd5e1' : '#475569',
                  }}
                >
                  Hành động xóa
                </Text>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                    lineHeight: '1.1',
                  }}
                >
                  {logs.filter(l => l.action?.includes('DELETE')).length}
                </div>
              </div>
            </div>
          </Card>

          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow:
                theme === 'dark'
                  ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                  : '0 1px 4px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: theme === 'dark' ? '#78350f' : '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    theme === 'dark'
                      ? '0 1px 3px rgba(251, 191, 36, 0.3)'
                      : '0 1px 3px rgba(251, 191, 36, 0.2)',
                }}
              >
                <FundOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#fbbf24' : '#d97706',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: theme === 'dark' ? '#cbd5e1' : '#475569',
                  }}
                >
                  Hành động cập nhật
                </Text>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                    lineHeight: '1.1',
                  }}
                >
                  {logs.filter(l => l.action?.includes('UPDATE')).length}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Logs Table Card */}
        <Card>
          <div style={{ padding: '16px' }}>
            <Title level={4} style={{ margin: 0 }}>
              Danh sách nhật ký
            </Title>
            <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginTop: '4px' }}>
              Tất cả hoạt động và thay đổi trong hệ thống
            </Text>
          </div>
          <div style={{ padding: 0 }}>
            <LogsTable logs={logs} loading={loading || tableLoading} />
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
                  pageSizeOptions={['10', '20', '50', '100']}
                  onChange={(page, pageSize) => {
                    setTableLoading(true);
                    setPagination(prev => ({
                      ...prev,
                      current: page,
                      pageSize: pageSize || prev.pageSize,
                    }));
                  }}
                  onShowSizeChange={(current, size) => {
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
