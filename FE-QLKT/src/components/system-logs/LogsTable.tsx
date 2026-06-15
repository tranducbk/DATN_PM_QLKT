'use client';
import { getRoleInfo } from '@/constants/roles.constants';
import { Table, Tag, Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  UserOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { getActionLabel } from './constants';
import { formatDateTimeFull } from '@/lib/utils';

export interface LogEntry {
  id: string;
  action: string;
  actor_name: string;
  actor_id?: string;
  actor_role: string;
  description: string;
  details: string;
  createdAt: string;
  resource?: string;
  resource_id?: string;
}

interface LogsTableProps {
  logs: LogEntry[];
  loading?: boolean;
  selectedRowKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
}

export function LogsTable({ logs, loading, selectedRowKeys, onSelectionChange }: LogsTableProps) {
  const selectable = !!onSelectionChange;

  const columns: ColumnsType<LogEntry> = [
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <ClockCircleOutlined />
          Thời gian
        </span>
      ),
      dataIndex: 'createdAt',
      key: 'time',
      width: 180,
      align: 'center',
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (value: string) => (
        <span className="whitespace-nowrap text-sm font-medium">{formatDateTimeFull(value)}</span>
      ),
    },
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <UserOutlined />
          Người dùng
        </span>
      ),
      key: 'actor',
      width: 160,
      align: 'center',
      sorter: (a, b) =>
        (a.actor_name || a.actor_id || '').localeCompare(b.actor_name || b.actor_id || ''),
      render: (_value, log) => (
        <div className="whitespace-normal break-words max-w-[160px] mx-auto text-sm font-medium">
          {log.actor_name || log.actor_id}
        </div>
      ),
    },
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <SafetyOutlined />
          Vai trò
        </span>
      ),
      dataIndex: 'actor_role',
      key: 'role',
      width: 140,
      align: 'center',
      sorter: (a, b) => (a.actor_role || '').localeCompare(b.actor_role || ''),
      render: (role: string) => <Tag color={getRoleInfo(role).color}>{getRoleInfo(role).label}</Tag>,
    },
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <ThunderboltOutlined />
          Hành động
        </span>
      ),
      dataIndex: 'action',
      key: 'action',
      width: 160,
      align: 'center',
      sorter: (a, b) => getActionLabel(a.action).localeCompare(getActionLabel(b.action)),
      render: (action: string) => (
        <span className="text-sm font-medium">{getActionLabel(action)}</span>
      ),
    },
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <FileTextOutlined />
          Chi tiết
        </span>
      ),
      key: 'details',
      width: 420,
      render: (_value, log) => (
        <div className="whitespace-normal break-words text-sm leading-relaxed">
          {log.details || log.description || '-'}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spin size="large" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải nhật ký...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Empty description="Không có nhật ký nào" />
      </div>
    );
  }

  return (
    <Table<LogEntry>
      rowKey="id"
      columns={columns}
      dataSource={logs}
      pagination={false}
      size="middle"
      rowSelection={
        selectable
          ? {
              selectedRowKeys,
              onChange: keys => onSelectionChange?.(keys as string[]),
            }
          : undefined
      }
      scroll={{ x: 'max-content' }}
    />
  );
}
