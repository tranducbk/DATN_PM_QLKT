'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Typography, Space, Tag, Select, Input, Empty, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import type { DateInput } from '@/lib/types/common';
import { MILITARY_RANKS } from '@/constants/militaryRanks.constants';
import { DANH_HIEU_DAC_BIET, AWARD_TAB_LABELS } from '@/constants/danhHieu.constants';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  cap_bac?: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
  CoQuanDonVi?: {
    ten_don_vi: string;
  };
  DonViTrucThuoc?: {
    ten_don_vi: string;
    CoQuanDonVi?: {
      ten_don_vi: string;
    };
  };
}

interface TitleData {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

interface Step3SetTitlesHCQKQTProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
  thang: number;
}

export function Step3SetTitlesHCQKQT({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
  thang,
}: Step3SetTitlesHCQKQTProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

  const fetchPersonnelDetails = useCallback(async () => {
    try {
      setLoading(true);
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnel(personnelData);

      // Initialize title data if empty
      if (titleData.length === 0) {
        const initialData = personnelData.map((p: Personnel) => ({
          personnel_id: p.id,
          danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT,
          cap_bac: p.cap_bac || '',
          chuc_vu: p.ChucVu?.ten_chuc_vu || '',
        }));
        onTitleDataChange(initialData);
      } else {
        // Merge into existing titleData without overwriting already-set values
        const updatedData = titleData.map(item => {
          const p = personnelData.find((pd: Personnel) => pd.id === item.personnel_id);
          return {
            ...item,
            danh_hieu: item.danh_hieu || DANH_HIEU_DAC_BIET.HC_QKQT,
            cap_bac: item.cap_bac || p?.cap_bac || '',
            chuc_vu: item.chuc_vu || p?.ChucVu?.ten_chuc_vu || '',
          };
        });
        if (JSON.stringify(updatedData) !== JSON.stringify(titleData)) {
          onTitleDataChange(updatedData);
        }
      }
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonnelIds, onTitleDataChange]);

  useEffect(() => {
    if (selectedPersonnelIds.length > 0) {
      fetchPersonnelDetails();
    } else {
      setPersonnel([]);
      onTitleDataChange([]);
    }
  }, [selectedPersonnelIds, fetchPersonnelDetails, onTitleDataChange]);

  const calculateTotalMonths = (ngayNhapNgu: DateInput, ngayXuatNgu: DateInput) => {
    if (!ngayNhapNgu) return null;

    try {
      const startDate = typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
      const refDate = new Date(nam, thang, 0);
      const endDate = ngayXuatNgu
        ? typeof ngayXuatNgu === 'string'
          ? new Date(ngayXuatNgu)
          : ngayXuatNgu
        : refDate;

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return null;
      }

      const totalMonths = Math.max(
        0,
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          endDate.getMonth() -
          startDate.getMonth()
      );
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

  const getTitleData = (id: string) => {
    return titleData.find(d => d.personnel_id === id) || { personnel_id: id };
  };

  const updateTitle = (id: string, field: string, value: any) => {
    const newData = [...titleData];
    const index = newData.findIndex(d => d.personnel_id === id);
    if (index >= 0) {
      newData[index] = { ...newData[index], [field]: value };
    } else {
      newData.push({ personnel_id: id, [field]: value });
    }
    onTitleDataChange(newData);
  };

  const columns: ColumnsType<Personnel> = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Họ và tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
      align: 'center',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'ngay_sinh',
      key: 'ngay_sinh',
      width: 140,
      align: 'center',
      render: (date: string) => (date ? formatDate(date) : '-'),
    },
    {
      title: (
        <span className="ant-form-item-required" aria-required>
          Cấp bậc
        </span>
      ),
      key: 'cap_bac',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <Select
            value={data.cap_bac ?? record.cap_bac ?? undefined}
            onChange={value => updateTitle(record.id, 'cap_bac', value)}
            placeholder="Chọn cấp bậc"
            style={{ width: '100%', height: 32 }}
            size="middle"
            showSearch
            optionFilterProp="label"
            allowClear
            options={MILITARY_RANKS.map(rank => ({ label: rank, value: rank }))}
          />
        );
      },
    },
    {
      title: (
        <span className="ant-form-item-required" aria-required>
          Chức vụ
        </span>
      ),
      key: 'chuc_vu',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <Input
            value={data.chuc_vu ?? record.ChucVu?.ten_chuc_vu ?? ''}
            onChange={e => updateTitle(record.id, 'chuc_vu', e.target.value)}
            placeholder="Nhập chức vụ"
            style={{ width: '100%', height: 32 }}
            size="middle"
            allowClear
          />
        );
      },
    },
    {
      title: 'Tổng tháng',
      key: 'tong_thang',
      width: 150,
      align: 'center',
      render: (_: unknown, record: Personnel) => {
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
    },
    {
      title: 'Danh hiệu',
      key: 'danh_hieu',
      width: 200,
      align: 'center',
      render: () => <Text>{AWARD_TAB_LABELS.HCQKQT}</Text>,
    },
  ];

  const allTitlesSet = personnel.every(p => {
    const data = titleData.find(d => d.personnel_id === p.id);
    return data?.danh_hieu === DANH_HIEU_DAC_BIET.HC_QKQT;
  });

  return (
    <div>
      <Alert
        message={`Bước 3: Thiết lập danh hiệu - ${AWARD_TAB_LABELS.HCQKQT}`}
        description={
          <div>
            <p>
              1. Xác nhận danh hiệu cho từng quân nhân đã chọn (<strong>{personnel.length}</strong>{' '}
              quân nhân)
            </p>
            <p>
              2. Điều kiện tối thiểu: thời gian phục vụ từ <strong>25 năm</strong> trở lên (không
              phân biệt giới tính).
            </p>
            <p>3. Đảm bảo tất cả quân nhân đã có danh hiệu trước khi chuyển bước.</p>
            <p>4. Hoàn tất khai báo, nhấn &quot;Tiếp tục&quot; để sang bước đính kèm tệp.</p>
          </div>
        }
        type="info"
        showIcon
        icon={<EditOutlined />}
        style={{ marginBottom: 24 }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space size="middle" align="center">
          <Tag color="red" style={{ fontSize: 14, padding: '4px 12px', margin: 0 }}>
            Tháng {thang} - Năm {nam}
          </Tag>
          <Text type="secondary">
            Tổng số quân nhân: <strong>{personnel.length}</strong>
          </Text>
        </Space>
        <Text type={allTitlesSet ? 'success' : 'warning'}>
          Đã thêm danh hiệu:{' '}
          <strong>
            {titleData.filter(d => d.danh_hieu).length}/{personnel.length}
          </strong>
          {allTitlesSet && ' ✓'}
        </Text>
      </div>

      <Table<Personnel>
        columns={columns}
        dataSource={personnel}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedPersonnelIds,
          onChange: (selectedRowKeys: React.Key[]) => {
            onPersonnelChange(selectedRowKeys as string[]);
            // Remove title data for deselected personnel
            const newTitleData = titleData.filter(d =>
              (selectedRowKeys as string[]).includes(d.personnel_id || '')
            );
            onTitleDataChange(newTitleData);
          },
        }}
        loading={loading}
        pagination={{
          ...DEFAULT_ANTD_TABLE_PAGINATION,
        }}
        bordered
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <Empty description="Không có dữ liệu" />,
        }}
      />
    </div>
  );
}
