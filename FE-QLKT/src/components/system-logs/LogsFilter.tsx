'use client';

import { useState, useEffect } from 'react';
import { Card, Input, DatePicker, Select, Button, Typography, Spin, Space } from 'antd';
import { SearchOutlined, ClearOutlined, CalendarOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/vi';
import type { SelectProps } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { ROLE_LABELS, getActionLabel } from './constants';

dayjs.locale('vi');

const { Text } = Typography;

const QUICK_DATE_LABELS = {
  today: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
  all: 'Tất cả',
} as const;

export interface LogsFilterValues {
  search?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
  action?: string;
}

interface LogsFilterProps {
  onFilterChange: (filters: LogsFilterValues) => void;
}

export function LogsFilter({ onFilterChange }: LogsFilterProps) {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [actorRole, setActorRole] = useState<string | undefined>();
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getSystemLogActions()
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setActions(Array.from(new Set(res.data.filter((a): a is string => Boolean(a)))).sort());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        onFilterChange({
          search: search.trim() || undefined,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          actorRole,
          action,
        });
      },
      search ? 300 : 0
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFilterChange is stable from parent
  }, [search, startDate, endDate, actorRole, action]);

  const handleReset = () => {
    setSearch('');
    setStartDate(null);
    setEndDate(null);
    setActorRole(undefined);
    setAction(undefined);
  };

  const handleQuickDateFilter = (type: 'today' | 'week' | 'month' | 'all') => {
    const today = dayjs();
    switch (type) {
      case 'today':
        setStartDate(today.startOf('day'));
        setEndDate(today.endOf('day'));
        break;
      case 'week':
        setStartDate(today.startOf('week'));
        setEndDate(today.endOf('week'));
        break;
      case 'month':
        setStartDate(today.startOf('month'));
        setEndDate(today.endOf('month'));
        break;
      case 'all':
        setStartDate(null);
        setEndDate(null);
        break;
    }
  };

  const hasActiveFilters = search || startDate || endDate || actorRole || action;

  const roleOptions: SelectProps['options'] = [
    { label: 'Tất cả', value: 'ALL' },
    ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value })),
  ];

  const actionOptions: SelectProps['options'] = [
    { label: 'Tất cả', value: 'ALL' },
    ...actions.map(a => ({ label: getActionLabel(a), value: a })),
  ];

  return (
    <Card
      className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
      title={
        <div className="flex items-center gap-2">
          <FilterOutlined className="text-blue-500" />
          <span className="text-gray-700 dark:text-gray-300 font-semibold">Bộ lọc tìm kiếm</span>
        </div>
      }
      extra={
        hasActiveFilters && (
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={handleReset}
            className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            Xóa bộ lọc
          </Button>
        )
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
              Lọc nhanh theo thời gian
            </Text>
            <Space wrap>
              {(['today', 'week', 'month', 'all'] as const).map(type => {
                const isActive =
                  type === 'all'
                    ? !startDate && !endDate
                    : startDate &&
                      endDate &&
                      dayjs()
                        .startOf(type === 'today' ? 'day' : type)
                        .isSame(startDate, 'day');
                return (
                  <Button
                    key={type}
                    size="small"
                    type={isActive ? 'primary' : 'default'}
                    onClick={() => handleQuickDateFilter(type)}
                  >
                    {QUICK_DATE_LABELS[type]}
                  </Button>
                );
              })}
            </Space>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2 lg:col-span-1">
              <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                Tìm kiếm
              </Text>
              <Input
                placeholder="Tìm kiếm theo hành động hoặc người dùng..."
                prefix={<SearchOutlined className="text-gray-400 dark:text-gray-500" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="large"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                Từ ngày
              </Text>
              <DatePicker
                placeholder="Chọn ngày"
                format="DD/MM/YYYY"
                value={startDate}
                onChange={date => setStartDate(date ? date.startOf('day') : null)}
                disabledDate={current => !!endDate && current > endDate}
                suffixIcon={<CalendarOutlined />}
                size="large"
                style={{ width: '100%' }}
                className="bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                Đến ngày
              </Text>
              <DatePicker
                placeholder="Chọn ngày"
                format="DD/MM/YYYY"
                value={endDate}
                onChange={date => setEndDate(date ? date.endOf('day') : null)}
                disabledDate={current => !!startDate && current < startDate}
                suffixIcon={<CalendarOutlined />}
                size="large"
                style={{ width: '100%' }}
                className="bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                Vai trò
              </Text>
              <Select
                placeholder="Chọn vai trò"
                value={actorRole || 'ALL'}
                onChange={v => setActorRole(v === 'ALL' ? undefined : v)}
                options={roleOptions}
                size="large"
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </div>

            <div>
              <Text className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                Hành động
              </Text>
              <Select
                placeholder="Tất cả"
                value={action || 'ALL'}
                onChange={v => setAction(v === 'ALL' ? undefined : v)}
                options={actionOptions}
                size="large"
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
