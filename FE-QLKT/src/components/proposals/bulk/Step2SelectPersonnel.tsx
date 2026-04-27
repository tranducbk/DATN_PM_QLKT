'use client';

import { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Alert, Typography, InputNumber, Empty, message } from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import type { DateInput } from '@/lib/types';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  cap_bac?: string;
  ngay_sinh?: string | null;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi?: {
      id: string;
      ten_don_vi: string;
      ma_don_vi: string;
    };
  };
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
}

interface Step2SelectPersonnelProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  proposalType?: string; // Determines whether to show enlistment/discharge date columns
}

export function Step2SelectPersonnel({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  proposalType,
}: Step2SelectPersonnelProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  // Fetch all personnel from manager's units
  useEffect(() => {
    fetchPersonnel();
  }, []);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPersonnel({
        page: 1,
        limit: FETCH_ALL_LIMIT,
      });

      if (response.success) {
        const personnelData = response.data || [];
        setPersonnel(personnelData);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Get unique units for filter
  const units = Array.from(
    new Set(
      personnel.map(p => {
        if (p.DonViTrucThuoc) {
          return `${p.DonViTrucThuoc.id}|${p.DonViTrucThuoc.ten_don_vi}`;
        } else if (p.CoQuanDonVi) {
          return `${p.CoQuanDonVi.id}|${p.CoQuanDonVi.ten_don_vi}`;
        }
        return '';
      })
    )
  ).filter(Boolean);

  // Filter personnel
  const filteredPersonnel = personnel.filter(p => {
    // Search filter
    const matchesSearch =
      searchText === '' || p.ho_ten.toLowerCase().includes(searchText.toLowerCase());

    // Unit filter
    const matchesUnit =
      !unitFilter ||
      unitFilter === 'ALL' ||
      p.don_vi_truc_thuoc_id === unitFilter.split('|')[0] ||
      p.co_quan_don_vi_id === unitFilter.split('|')[0];

    return matchesSearch && matchesUnit;
  });

  const columns: ColumnsType<Personnel> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Họ và tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
      align: 'center',
      render: (text: string, record) => {
        const coQuan = record.DonViTrucThuoc?.CoQuanDonVi || record.CoQuanDonVi;
        const donViTrucThuoc = record.DonViTrucThuoc;

        const donViDisplay: string | null = donViTrucThuoc?.ten_don_vi
          ? coQuan?.ten_don_vi
            ? `${donViTrucThuoc.ten_don_vi} (${coQuan.ten_don_vi})`
            : donViTrucThuoc.ten_don_vi
          : coQuan?.ten_don_vi || null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            {donViDisplay && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: 4 }}>
                {donViDisplay}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'ngay_sinh',
      key: 'ngay_sinh',
      width: 140,
      align: 'center',
      render: (date: string | undefined | null) => (date ? formatDate(date) : '-'),
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const capBac = record.cap_bac;
        const chucVu = record.ChucVu?.ten_chuc_vu;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong style={{ marginBottom: '4px' }}>
              {capBac || '-'}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {chucVu || '-'}
            </Text>
          </div>
        );
      },
    },
  ];

  if (proposalType === PROPOSAL_TYPES.NIEN_HAN) {
    const calculateTotalMonths = (
      ngayNhapNgu: DateInput,
      ngayXuatNgu: DateInput
    ) => {
      if (!ngayNhapNgu) return null;

      try {
        const startDate = typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
        const endDate = ngayXuatNgu
          ? typeof ngayXuatNgu === 'string'
            ? new Date(ngayXuatNgu)
            : ngayXuatNgu
          : new Date(); // Use current date if still serving

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return null;
        }

        const totalMonths = Math.max(0, (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth());
        const totalYears = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;

        return {
          years: totalYears,
          months: remainingMonths,
          totalMonths: totalMonths,
        };
      } catch {
        return null;
      }
    };

    columns.push(
      {
        title: 'Ngày nhập ngũ',
        key: 'ngay_nhap_ngu',
        width: 150,
        align: 'center',
        render: (_, record) => {
          if (!record.ngay_nhap_ngu) return <Text type="secondary">-</Text>;
          try {
            const date =
              typeof record.ngay_nhap_ngu === 'string'
                ? new Date(record.ngay_nhap_ngu)
                : record.ngay_nhap_ngu;
            return formatDate(date);
          } catch {
            return <Text type="secondary">-</Text>;
          }
        },
      },
      {
        title: 'Ngày xuất ngũ',
        key: 'ngay_xuat_ngu',
        width: 150,
        align: 'center',
        render: (_, record) => {
          if (!record.ngay_xuat_ngu) return <Text type="secondary">Chưa xuất ngũ</Text>;
          try {
            const date =
              typeof record.ngay_xuat_ngu === 'string'
                ? new Date(record.ngay_xuat_ngu)
                : record.ngay_xuat_ngu;
            return formatDate(date);
          } catch {
            return <Text type="secondary">-</Text>;
          }
        },
      },
      {
        title: 'Tổng tháng',
        key: 'tong_thang',
        width: 150,
        align: 'center',
        render: (_, record) => {
          const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
          if (!result) return <Text type="secondary">-</Text>;

          if (result.years > 0 && result.months > 0) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text strong>{result.years} năm</Text>
                <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.2' }}>
                  {result.months} tháng
                </Text>
              </div>
            );
          } else if (result.years > 0) {
            return <Text strong>{result.years} năm</Text>;
          } else if (result.totalMonths > 0) {
            return <Text strong>{result.totalMonths} tháng</Text>;
          } else {
            return <Text type="secondary">0 tháng</Text>;
          }
        },
      }
    );
  }

  // Row selection config
  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Lựa chọn quân nhân"
        description={
          <div>
            <p>1. Chọn năm đề xuất để xác định kỳ xét.</p>
            <p>
              2. Lựa chọn quân nhân trong phạm vi đơn vị quản lý (bao gồm cơ quan đơn vị và đơn vị
              trực thuộc).
            </p>
            <p>3. Kiểm tra lại danh sách đã chọn và nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu.</p>
          </div>
        }
        type="info"
        showIcon
        icon={<TeamOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <div>
          <Text strong>Năm đề xuất: </Text>
          <InputNumber
            value={nam}
            onChange={value => onNamChange(value || new Date().getFullYear())}
            style={{ width: 150 }}
            size="large"
            min={1900}
            max={2100}
            placeholder="Nhập năm"
          />
        </div>

        <Input
          placeholder="Tìm theo tên"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
          size="large"
          allowClear
        />

        <Select
          placeholder="Lọc theo đơn vị"
          value={unitFilter}
          onChange={value => setUnitFilter(value || 'ALL')}
          style={{ width: 250 }}
          size="large"
          allowClear
        >
          <Select.Option value="ALL">Tất cả đơn vị</Select.Option>
          {units.map(unit => {
            const [id, name] = unit.split('|');
            return (
              <Select.Option key={id} value={unit}>
                {name}
              </Select.Option>
            );
          })}
        </Select>
      </Space>

      {/* Summary */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Tổng số quân nhân: <strong>{filteredPersonnel.length}</strong> | Đã chọn:{' '}
          <strong style={{ color: '#1890ff' }}>{selectedPersonnelIds.length}</strong>
        </Text>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredPersonnel}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={{
          ...DEFAULT_ANTD_TABLE_PAGINATION,
          showTotal: total => `Tổng số ${total} quân nhân`,
        }}
        bordered
        scroll={{ x: proposalType === PROPOSAL_TYPES.NIEN_HAN ? 1650 : 1200 }}
        locale={{
          emptyText: <Empty description="Không có dữ liệu quân nhân" />,
        }}
      />
    </div>
  );
}
