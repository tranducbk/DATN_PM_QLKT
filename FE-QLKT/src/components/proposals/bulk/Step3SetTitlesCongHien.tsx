'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Select, Alert, Typography, Space, Tag, message, Button, Input, Empty } from 'antd';
import { EditOutlined, HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { PositionHistoryModal } from './PositionHistoryModal';
import { MILITARY_RANKS } from '@/constants/militaryRanks.constants';
import {
  calculateContributionMonthsByGroup,
  formatMonthsToText,
  getContributionRequiredMonths,
  getHighestEligibleContributionAward,
  getReferenceEndDate,
} from '@/lib/award/contributionTimeHelper';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  cap_bac?: string;
  gioi_tinh?: string | null;
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
  thoi_gian_nhom_0_7?: { years: number; months: number } | null;
  thoi_gian_nhom_0_8?: { years: number; months: number } | null;
  thoi_gian_nhom_0_9_1_0?: { years: number; months: number } | null;
}

interface Step3SetTitlesCongHienProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
  thang: number;
}

export function Step3SetTitlesCongHien({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
  thang,
}: Step3SetTitlesCongHienProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<Record<string, any[]>>({});
  const [positionHistoryModalVisible, setPositionHistoryModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const fetchPersonnelDetails = useCallback(async () => {
    try {
      setLoading(true);
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnel(personnelData);

      const historiesMap = await fetchPositionHistories(personnelData);

      // Helper function to convert months to {years, months} object
      const monthsToTimeObject = (totalMonths: number) => {
        if (!totalMonths || totalMonths <= 0) return null;
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        return { years, months };
      };

      const monthsByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') =>
        calculateTotalMonthsByGroup(historiesMap[personnelId] || [], group);
      const requiredMonths = (person: Personnel) => getContributionRequiredMonths(person.gioi_tinh);
      const resolveDanhHieu = (person: Personnel): string | undefined => {
        const m07 = monthsByGroup(person.id, '0.7');
        const m08 = monthsByGroup(person.id, '0.8');
        const m0910 = monthsByGroup(person.id, '0.9-1.0');
        const required = requiredMonths(person);
        return getHighestEligibleContributionAward(m07, m08, m0910, required) || undefined;
      };

      // Initialize title data if empty
      if (titleData.length === 0) {
        const initialData = personnelData.map((p: Personnel) => {
          const m07 = monthsByGroup(p.id, '0.7');
          const m08 = monthsByGroup(p.id, '0.8');
          const m0910 = monthsByGroup(p.id, '0.9-1.0');
          return {
            personnel_id: p.id,
            danh_hieu: resolveDanhHieu(p),
            cap_bac: p.cap_bac || '',
            chuc_vu: p.ChucVu?.ten_chuc_vu || '',
            thoi_gian_nhom_0_7: monthsToTimeObject(m07),
            thoi_gian_nhom_0_8: monthsToTimeObject(m08),
            thoi_gian_nhom_0_9_1_0: monthsToTimeObject(m0910),
          };
        });
        onTitleDataChange(initialData);
      } else {
        const updatedData = titleData.map(item => {
          const p = personnelData.find((pd: Personnel) => pd.id === item.personnel_id);
          if (p) {
            const m07 = monthsByGroup(p.id, '0.7');
            const m08 = monthsByGroup(p.id, '0.8');
            const m0910 = monthsByGroup(p.id, '0.9-1.0');
            return {
              ...item,
              cap_bac: item.cap_bac || p.cap_bac || '',
              chuc_vu: item.chuc_vu || p.ChucVu?.ten_chuc_vu || '',
              danh_hieu: resolveDanhHieu(p),
              thoi_gian_nhom_0_7: monthsToTimeObject(m07),
              thoi_gian_nhom_0_8: monthsToTimeObject(m08),
              thoi_gian_nhom_0_9_1_0: monthsToTimeObject(m0910),
            };
          }
          return item;
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
  }, [selectedPersonnelIds, nam, thang, onTitleDataChange]);

  useEffect(() => {
    if (selectedPersonnelIds.length > 0) {
      fetchPersonnelDetails();
    } else {
      setPersonnel([]);
      onTitleDataChange([]);
    }
  }, [selectedPersonnelIds, nam, thang, fetchPersonnelDetails, onTitleDataChange]);

  const fetchPositionHistories = async (personnelList: Personnel[]) => {
    try {
      const historiesMap: Record<string, any[]> = {};

      await Promise.all(
        personnelList.map(async p => {
          if (p.id) {
            try {
              const res = await apiClient.getPositionHistory(p.id);
              if (res.success && res.data) {
                historiesMap[p.id] = res.data;
              }
            } catch (error) {
              historiesMap[p.id] = [];
            }
          }
        })
      );

      setPositionHistoriesMap(historiesMap);
      return historiesMap;
    } catch (error) {
      message.error(getApiErrorMessage(error));
      return {};
    }
  };

  const calculateTotalMonthsByGroup = (histories: any[], group: '0.7' | '0.8' | '0.9-1.0') => {
    if (!histories?.length) return 0;
    const referenceEndDate = getReferenceEndDate(nam, thang);
    return calculateContributionMonthsByGroup(histories, group, referenceEndDate);
  };

  /** Computes total service months for a coefficient group from position history by proposal month/year. */
  const calculateTotalTimeByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') => {
    const histories = positionHistoriesMap[personnelId] || [];
    const totalMonths = calculateTotalMonthsByGroup(histories, group);
    return formatMonthsToText(totalMonths);
  };

  const updateTitle = async (id: string, field: string, value: any) => {
    // danh_hieu is auto-set to the highest eligible rank — no manual validation needed

    const newData = [...titleData];
    const index = newData.findIndex(d => d.personnel_id === id);
    if (index >= 0) {
      newData[index] = { ...newData[index], [field]: value };
    } else {
      newData.push({ personnel_id: id, [field]: value });
    }

    onTitleDataChange(newData);
  };

  const getTitleData = (id: string) => {
    return titleData.find(d => d.personnel_id === id) || { personnel_id: id };
  };

  const handleViewHistory = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setLoadingModal(true);
    setPositionHistoryModalVisible(true);

    try {
      const historyRes = await apiClient.getPositionHistory(record.id);
      if (historyRes.success && historyRes.data) {
        setPositionHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      } else {
        setPositionHistory([]);
      }
    } catch (error: unknown) {
      message.error('Không thể tải lịch sử chức vụ');
      setPositionHistory([]);
    } finally {
      setLoadingModal(false);
    }
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
        <span>
          Cấp bậc <Text type="danger">*</Text>
        </span>
      ),
      key: 'cap_bac',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <Select
            value={data.cap_bac || record.cap_bac}
            onChange={value => updateTitle(record.id, 'cap_bac', value)}
            placeholder="Chọn cấp bậc"
            style={{ width: '100%', height: 32 }}
            size="middle"
            showSearch
            optionFilterProp="label"
            options={MILITARY_RANKS.map(rank => ({ label: rank, value: rank }))}
          />
        );
      },
    },
    {
      title: (
        <span>
          Chức vụ <Text type="danger">*</Text>
        </span>
      ),
      key: 'chuc_vu',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <Input
            value={data.chuc_vu || record.ChucVu?.ten_chuc_vu || ''}
            onChange={e => updateTitle(record.id, 'chuc_vu', e.target.value)}
            placeholder="Nhập chức vụ"
            style={{ width: '100%', height: 32 }}
            size="middle"
          />
        );
      },
    },
    {
      title: (
        <span>
          Danh hiệu <Text type="danger">*</Text>
        </span>
      ),
      key: 'danh_hieu',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        const awardLabels: Record<string, string> = {
          HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc hạng Nhất',
          HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc hạng Nhì',
          HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc hạng Ba',
        };

        return (
          <Text strong style={{ color: !data.danh_hieu ? '#ff4d4f' : undefined }}>
            {data.danh_hieu ? awardLabels[data.danh_hieu] || data.danh_hieu : 'Chưa xác định'}
          </Text>
        );
      },
    },
    {
      title: 'Tổng thời gian (0.7)',
      key: 'total_time_0_7',
      width: 150,
      align: 'center',
      render: (_: unknown, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.7'),
    },
    {
      title: 'Tổng thời gian (0.8)',
      key: 'total_time_0_8',
      width: 150,
      align: 'center',
      render: (_: unknown, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.8'),
    },
    {
      title: 'Tổng thời gian (0.9-1.0)',
      key: 'total_time_0_9_1_0',
      width: 150,
      align: 'center',
      render: (_: unknown, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.9-1.0'),
    },
    {
      title: 'Xem lịch sử chức vụ',
      key: 'history',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => handleViewHistory(record)}
          size="small"
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];

  const allTitlesSet = personnel.every(p => {
    const data = getTitleData(p.id);
    return data.danh_hieu;
  });

  return (
    <div>
      <Alert
        message="Bước 3: Thiết lập danh hiệu - Huân chương Bảo vệ Tổ quốc"
        description={
          <div>
            <p>
              1. Thiết lập danh hiệu cho <strong>{personnel.length}</strong> quân nhân đã chọn.
            </p>
            <p style={{ marginTop: 8, paddingLeft: 16, borderLeft: '3px solid #1890ff' }}>
              <strong>Quy tắc xét điều kiện:</strong>
              <br />- Thời gian phục vụ tối thiểu: Nam 10 năm (120 tháng), Nữ 6 năm 8 tháng (80 tháng).
              <br />- hạng Nhất: xét nhóm hệ số 0.9-1.0.
              <br />- hạng Nhì: xét nhóm 0.8 + 0.9-1.0.
              <br />- hạng Ba: xét nhóm 0.7 + 0.8 + 0.9-1.0.
            </p>
            <p>2. Kiểm tra để tất cả quân nhân đều đã có danh hiệu trước khi chuyển bước.</p>
            <p>3. Hoàn tất khai báo, nhấn &quot;Tiếp tục&quot; để sang bước đính kèm tệp.</p>
          </div>
        }
        type="info"
        showIcon
        icon={<EditOutlined />}
        style={{ marginBottom: 24 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

      <PositionHistoryModal
        visible={positionHistoryModalVisible}
        personnel={selectedPersonnel}
        positionHistory={positionHistory}
        loading={loadingModal}
        onClose={() => {
          setPositionHistoryModalVisible(false);
          setSelectedPersonnel(null);
          setPositionHistory([]);
        }}
      />
    </div>
  );
}
