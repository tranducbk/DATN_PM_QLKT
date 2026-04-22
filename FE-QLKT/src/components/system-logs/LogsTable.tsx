'use client';
import { useState, useMemo } from 'react';
import { getRoleInfo } from '@/constants/roles.constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tag, Empty } from 'antd';
import { getActionLabel, ACTION_LABELS } from './constants';
import {
  Loader2,
  Clock,
  User,
  Shield,
  Activity,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
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

type SortField = 'time' | 'actor' | 'role' | 'action' | null;
type SortOrder = 'asc' | 'desc' | null;

// Mapping cho resource labels (kebab-case keys only — getResourceLabel normalizes _ → -)
const resourceLabels: Record<string, string> = {
  accounts: 'Tài khoản',
  personnel: 'Quân nhân',
  profiles: 'Hồ sơ quân nhân',
  units: 'Đơn vị',
  positions: 'Chức vụ',
  proposals: 'Đề xuất',
  decisions: 'Quyết định',
  awards: 'Khen thưởng',
  'award-bulk': 'Khen thưởng hàng loạt',
  auth: 'Xác thực',
  'annual-rewards': 'Khen thưởng cá nhân hằng năm',
  'unit-annual-awards': 'Khen thưởng đơn vị hằng năm',
  'adhoc-awards': 'Khen thưởng đột xuất',
  'tenure-medals': 'Huy chương Chiến sĩ vẻ vang',
  'contribution-medals': 'Huân chương Bảo vệ Tổ quốc',
  'commemorative-medals': 'Kỷ niệm chương VSNXD QĐNDVN',
  'military-flag': 'Huy chương Quân kỳ Quyết thắng',
  'scientific-achievements': 'Thành tích NCKH',
  'position-history': 'Lịch sử chức vụ',
  'system-logs': 'Nhật ký hệ thống',
};

function getResourceLabel(resource: string): string {
  if (!resource) return '';
  const normalized = resource.replace(/_/g, '-');
  return resourceLabels[resource] || resourceLabels[normalized] || resource;
}

const actionColors: Record<string, string> = {
  CREATE:
    'bg-green-100/50 text-green-900 dark:bg-green-900/60 dark:text-green-50 border-green-300 dark:border-green-600',
  UPDATE:
    'bg-blue-100/50 text-blue-900 dark:bg-blue-900/60 dark:text-blue-50 border-blue-300 dark:border-blue-600',
  DELETE:
    'bg-red-100/50 text-red-900 dark:bg-red-900/60 dark:text-red-50 border-red-300 dark:border-red-600',
  RESET:
    'bg-yellow-100/50 text-yellow-900 dark:bg-yellow-900/60 dark:text-yellow-50 border-yellow-300 dark:border-yellow-600',
  APPROVE:
    'bg-emerald-100/50 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-50 border-emerald-300 dark:border-emerald-600',
  REJECT:
    'bg-orange-100/50 text-orange-900 dark:bg-orange-900/60 dark:text-orange-50 border-orange-300 dark:border-orange-600',
};

function getActionColor(action: string): string {
  if (action.includes('CREATE')) return actionColors.CREATE;
  if (action.includes('UPDATE')) return actionColors.UPDATE;
  if (action.includes('DELETE')) return actionColors.DELETE;
  if (action.includes('RESET')) return actionColors.RESET;
  if (action.includes('APPROVE')) return actionColors.APPROVE;
  if (action.includes('REJECT')) return actionColors.REJECT;
  return 'bg-gray-100/50 text-gray-900 dark:bg-gray-800/60 dark:text-gray-50 border-gray-300 dark:border-gray-600';
}

export function LogsTable({ logs, loading, selectedRowKeys, onSelectionChange }: LogsTableProps) {
  const selectable = !!onSelectionChange;
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedLogs = useMemo(() => {
    if (!sortField || !sortOrder) return logs;

    const getFieldValue = (log: (typeof logs)[number]): string => {
      const fieldMap: Record<string, string> = {
        actor: (log.actor_name || log.actor_id || '').toLowerCase(),
        role: (log.actor_role || '').toLowerCase(),
        action: (ACTION_LABELS[log.action] || log.action || '').toLowerCase(),
      };
      return fieldMap[sortField] ?? '';
    };

    const sorted = [...logs].sort((a, b) => {
      if (sortField === 'time') {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? diff : -diff;
      }
      const aValue = getFieldValue(a);
      const bValue = getFieldValue(b);
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [logs, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-blue-500" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 dark:text-blue-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Đang tải nhật ký...</p>
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
    <div className="overflow-x-auto">
      <Table className="w-full">
        <TableHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <TableRow className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 border-0">
            {selectable && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={sortedLogs.length > 0 && selectedRowKeys?.length === sortedLogs.length}
                  onChange={e => {
                    onSelectionChange?.(e.target.checked ? sortedLogs.map(l => l.id) : []);
                  }}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </TableHead>
            )}
            <TableHead
              className="w-[180px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('time')}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                Thời gian
                <SortIcon field="time" />
              </div>
            </TableHead>
            <TableHead
              className="w-[160px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('actor')}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0" />
                Người dùng
                <SortIcon field="actor" />
              </div>
            </TableHead>
            <TableHead
              className="w-[140px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('role')}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0" />
                Vai trò
                <SortIcon field="role" />
              </div>
            </TableHead>
            <TableHead
              className="w-[160px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('action')}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 shrink-0" />
                Hành động
                <SortIcon field="action" />
              </div>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Chi tiết
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLogs.map(log => (
            <TableRow
              key={log.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-gray-200 dark:border-gray-700"
            >
              {selectable && (
                <TableCell className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedRowKeys?.includes(log.id) ?? false}
                    onChange={e => {
                      const keys = selectedRowKeys || [];
                      onSelectionChange?.(
                        e.target.checked ? [...keys, log.id] : keys.filter(k => k !== log.id)
                      );
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </TableCell>
              )}
              <TableCell className="text-sm text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                {formatDateTimeFull(log.createdAt)}
              </TableCell>
              <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">
                <div className="whitespace-normal break-words max-w-[160px]">
                  {log.actor_name || log.actor_id}
                </div>
              </TableCell>
              <TableCell>
                <Tag color={getRoleInfo(log.actor_role).color}>
                  {getRoleInfo(log.actor_role).label}
                </Tag>
              </TableCell>
              <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {getActionLabel(log.action)}
              </TableCell>
              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                <div className="whitespace-normal break-words min-w-0">
                  {log.details || log.description || '-'}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
