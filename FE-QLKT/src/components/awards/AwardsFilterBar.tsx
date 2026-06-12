'use client';

import { Card, Input, Select, Button, Space, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface AwardFilters {
  nam: string;
  ho_ten: string;
  danh_hieu: string;
  de_tai: string;
}

interface AwardsFilterBarProps {
  filters: AwardFilters;
  availableYears: number[];
  danhHieuOptions: { value: string; label: string }[];
  showDanhHieuFilter: boolean;
  showTopicFilter: boolean;
  searchLabel: string;
  searchPlaceholder: string;
  danhHieuPlaceholder: string;
  onFilterChange: (key: keyof AwardFilters, value: string) => void;
  onReset: () => void;
}

export function AwardsFilterBar({
  filters,
  availableYears,
  danhHieuOptions,
  showDanhHieuFilter,
  showTopicFilter,
  searchLabel,
  searchPlaceholder,
  danhHieuPlaceholder,
  onFilterChange,
  onReset,
}: AwardsFilterBarProps) {
  return (
    <Card
      title={
        <Space>
          <FilterOutlined />
          Bộ lọc
        </Space>
      }
      style={{ marginBottom: '24px' }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>
            Năm
          </Text>
          <Select
            placeholder="Tất cả các năm"
            value={filters.nam === '' ? '' : filters.nam || undefined}
            onChange={value => onFilterChange('nam', value || '')}
            allowClear
            size="large"
            style={{ width: '100%' }}
            options={[
              { value: '', label: 'Tất cả các năm' },
              ...availableYears.map(year => ({
                value: String(year),
                label: String(year),
              })),
            ]}
          />
        </div>
        <div
          style={{
            flex: '1 1 200px',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>
            {searchLabel}
          </Text>
          <Input
            placeholder={searchPlaceholder}
            value={filters.ho_ten}
            onChange={e => onFilterChange('ho_ten', e.target.value)}
            allowClear
            size="large"
          />
        </div>
        {showDanhHieuFilter && (
          <div
            style={{
              flex: '1 1 250px',
              minWidth: '250px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Danh hiệu
            </Text>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder={danhHieuPlaceholder}
              value={filters.danh_hieu === '' ? '' : filters.danh_hieu || undefined}
              onChange={value => onFilterChange('danh_hieu', value || '')}
              options={danhHieuOptions}
              size="large"
            />
          </div>
        )}
        {showTopicFilter && (
          <div
            style={{
              flex: '1 1 200px',
              minWidth: '200px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Đề tài
            </Text>
            <Input
              placeholder="Nhập đề tài / mô tả"
              value={filters.de_tai}
              onChange={e => onFilterChange('de_tai', e.target.value)}
              allowClear
              size="large"
            />
          </div>
        )}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '22px', marginBottom: '8px' }}></div>
          <Button size="large" onClick={onReset} icon={null}>
            Xóa bộ lọc
          </Button>
        </div>
      </div>
    </Card>
  );
}
