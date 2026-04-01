'use client';

import { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Alert, Typography, Tag, InputNumber, Empty } from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
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
  proposalType?: string; // Để biết khi nào cần hiển thị ngày nhập ngũ/xuất ngũ
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
      // Gọi API lấy danh sách personnel thuộc đơn vị của manager
      const response = await apiClient.getPersonnel({
        // Manager chỉ lấy personnel trong đơn vị của mình
        // Backend sẽ tự filter dựa trên token
        page: 1,
        limit: 1000, // Lấy tất cả
      });

      if (response.success) {
        // Backend trả về { success: true, data: { personnel: [], pagination: {} } }
        const personnelData = response.data?.personnel ?? [];
        setPersonnel(personnelData);
      }
    } catch (error: unknown) {
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
    let matchesUnit = true;
    if (unitFilter && unitFilter !== 'ALL') {
      const unitId = unitFilter.split('|')[0];
      matchesUnit = p.don_vi_truc_thuoc_id === unitId || p.co_quan_don_vi_id === unitId;
    }

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
        // Hiển thị thêm Cơ quan đơn vị / Đơn vị trực thuộc ngay dưới họ tên
        const coQuan = record.DonViTrucThuoc?.CoQuanDonVi || record.CoQuanDonVi;
        const donViTrucThuoc = record.DonViTrucThuoc;

        let donViDisplay: string | null = null;

        if (donViTrucThuoc?.ten_don_vi) {
          // Ưu tiên đơn vị trực thuộc, kèm theo cơ quan nếu có
          donViDisplay = coQuan?.ten_don_vi
            ? `${donViTrucThuoc.ten_don_vi} (${coQuan.ten_don_vi})`
            : donViTrucThuoc.ten_don_vi;
        } else if (coQuan?.ten_don_vi) {
          // Chỉ có cơ quan đơn vị
          donViDisplay = coQuan.ten_don_vi;
        }

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

  // Thêm cột ngày nhập ngũ, xuất ngũ và tổng tháng cho đề xuất niên hạn
  if (proposalType === PROPOSAL_TYPES.NIEN_HAN) {
    // Hàm tính tổng số tháng từ ngày nhập ngũ đến hiện tại (hoặc ngày xuất ngũ)
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
          : new Date(); // Nếu chưa xuất ngũ thì tính đến hiện tại

        // Đảm bảo startDate và endDate hợp lệ
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return null;
        }

        // Tính số năm và tháng chính xác
        let years = endDate.getFullYear() - startDate.getFullYear();
        let months = endDate.getMonth() - startDate.getMonth();
        let days = endDate.getDate() - startDate.getDate();

        // Điều chỉnh nếu ngày cuối nhỏ hơn ngày đầu
        if (days < 0) {
          months -= 1;
          // Lấy số ngày của tháng trước đó
          const lastDayOfPrevMonth = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            0
          ).getDate();
          days += lastDayOfPrevMonth;
        }

        // Điều chỉnh nếu tháng cuối nhỏ hơn tháng đầu
        if (months < 0) {
          years -= 1;
          months += 12;
        }

        // Tính tổng số tháng (làm tròn xuống)
        const totalMonths = years * 12 + months;

        // Tính số năm và tháng còn lại để hiển thị
        const totalYears = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;

        // Trả về object với years và months riêng biệt
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

          // Hiển thị năm ở trên, tháng nhỏ bên dưới
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
        message="Hướng dẫn"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>
              2. Chọn các quân nhân cần đề xuất khen thưởng từ danh sách dưới đây (bao gồm tất cả
              quân nhân thuộc cơ quan đơn vị và đơn vị trực thuộc của bạn)
            </p>
            <p>3. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu</p>
          </div>
        }
        type="info"
        showIcon
        icon={<TeamOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} size="middle">
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
