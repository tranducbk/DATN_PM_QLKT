'use client';

import { Button, Card, Col, Row, Select, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { getProposalTypeLabel } from '@/constants/proposal.constants';

const { Text } = Typography;

interface ProposalListFilterBarProps {
  availableYears: number[];
  availableTypes: string[];
  yearFilter: number | '';
  onYearChange: (value: number | '') => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  onReset: () => void;
  filteredCount: number;
  totalCount: number;
}

export function ProposalListFilterBar({
  availableYears,
  availableTypes,
  yearFilter,
  onYearChange,
  typeFilter,
  onTypeChange,
  onReset,
  filteredCount,
  totalCount,
}: ProposalListFilterBarProps) {
  const showSummary = yearFilter !== '' || typeFilter !== '';

  return (
    <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '16px' } }}>
      <Row gutter={[16, 16]} align="bottom">
        <Col xs={24} sm={12} md={6}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                display: 'block',
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <FilterOutlined /> Năm
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả các năm"
              value={yearFilter || ''}
              onChange={value => onYearChange(value ? Number(value) : '')}
              allowClear={yearFilter !== ''}
              size="large"
            >
              <Select.Option value="">Tất cả các năm</Select.Option>
              {availableYears.map(year => (
                <Select.Option key={year} value={year}>
                  {year}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                display: 'block',
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <FilterOutlined /> Loại đề xuất
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả loại"
              value={typeFilter || ''}
              onChange={value => onTypeChange(value || '')}
              allowClear={typeFilter !== ''}
              size="large"
            >
              <Select.Option value="">Tất cả các loại đề xuất</Select.Option>
              {availableTypes.map(type => (
                <Select.Option key={type} value={type}>
                  {getProposalTypeLabel(type)}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Col>
        <Col xs={24} sm={24} md={4}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '22px', marginBottom: '8px' }} />
            <Button onClick={onReset} size="large" style={{ width: '100%' }} icon={null}>
              Xóa bộ lọc
            </Button>
          </div>
        </Col>
      </Row>
      {showSummary && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            Đang hiển thị <strong>{filteredCount}</strong> / {totalCount} đề xuất
          </Text>
        </div>
      )}
    </Card>
  );
}
