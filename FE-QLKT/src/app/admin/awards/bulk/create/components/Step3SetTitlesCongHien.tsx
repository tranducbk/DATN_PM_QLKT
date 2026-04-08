'use client';

import { useState, useEffect } from 'react';
import { Table, Select, Alert, Typography, Space, Tag, message, Button, Input, Empty } from 'antd';
import { EditOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { PositionHistoryModal } from './PositionHistoryModal';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';

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
}

export function Step3SetTitlesCongHien({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
}: Step3SetTitlesCongHienProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<Record<string, any[]>>({});
  const [positionHistoryModalVisible, setPositionHistoryModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [contributionProfiles, setContributionProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (selectedPersonnelIds.length > 0) {
      fetchPersonnelDetails();
    } else {
      setPersonnel([]);
      onTitleDataChange([]);
    }
  }, [selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      setLoading(true);
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnel(personnelData);

      // Trigger recalculate cho contribution profiles
      const profilesMap: Record<string, any> = {};

      await Promise.all(
        personnelData.map(async p => {
          if (p.id) {
            try {
              const response = await apiClient.getContributionProfile(p.id);
              if (response.success && response.data) {
                profilesMap[p.id] = response.data;
              }
            } catch (error) {
              // Error handled silently per-item
            }
          }
        })
      );
      setContributionProfiles(profilesMap);
      // Fetch position histories for display
      await fetchPositionHistories(personnelData);

      // Helper function to convert months to {years, months} object
      const monthsToTimeObject = (totalMonths: number) => {
        if (!totalMonths || totalMonths <= 0) return null;
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        return { years, months };
      };

      // Initialize title data if empty
      if (titleData.length === 0) {
        const initialData = personnelData.map((p: Personnel) => {
          const profile = profilesMap[p.id];
          return {
            personnel_id: p.id,
            danh_hieu: getHighestEligibleAward(profile),
            cap_bac: p.cap_bac || '',
            chuc_vu: p.ChucVu?.ten_chuc_vu || '',
            thoi_gian_nhom_0_7: monthsToTimeObject(profile?.months_07 || 0),
            thoi_gian_nhom_0_8: monthsToTimeObject(profile?.months_08 || 0),
            thoi_gian_nhom_0_9_1_0: monthsToTimeObject(profile?.months_0910 || 0),
          };
        });
        onTitleDataChange(initialData);
      } else {
        const updatedData = titleData.map(item => {
          const p = personnelData.find((pd: Personnel) => pd.id === item.personnel_id);
          const profile = profilesMap[item.personnel_id || ''];
          const needsUpdate =
            !item.cap_bac ||
            !item.chuc_vu ||
            !item.thoi_gian_nhom_0_7 ||
            !item.thoi_gian_nhom_0_8 ||
            !item.thoi_gian_nhom_0_9_1_0;

          if (p && needsUpdate) {
            return {
              ...item,
              cap_bac: item.cap_bac || p.cap_bac || '',
              chuc_vu: item.chuc_vu || p.ChucVu?.ten_chuc_vu || '',
              thoi_gian_nhom_0_7:
                item.thoi_gian_nhom_0_7 || monthsToTimeObject(profile?.months_07 || 0),
              thoi_gian_nhom_0_8:
                item.thoi_gian_nhom_0_8 || monthsToTimeObject(profile?.months_08 || 0),
              thoi_gian_nhom_0_9_1_0:
                item.thoi_gian_nhom_0_9_1_0 || monthsToTimeObject(profile?.months_0910 || 0),
            };
          }
          return item;
        });
        if (JSON.stringify(updatedData) !== JSON.stringify(titleData)) {
          onTitleDataChange(updatedData);
        }
      }
    } catch (error) {
      console.error('Lỗi tải dữ liệu danh hiệu cống hiến', error);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error) {
      console.error('Lỗi tải lịch sử chức vụ cống hiến', error);
    }
  };

  /** Computes total service months for a coefficient group from API data. */
  const calculateTotalTimeByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') => {
    let totalMonths = 0;
    if (group === '0.7') totalMonths = contributionProfiles[personnelId]?.months_07 || 0;
    else if (group === '0.8') totalMonths = contributionProfiles[personnelId]?.months_08 || 0;
    else if (group === '0.9-1.0') totalMonths = contributionProfiles[personnelId]?.months_0910 || 0;

    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (totalMonths === 0) return '-';
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

  /** Checks whether a personnel meets the service-time requirement for a given HCBVTQ rank. */
  const checkEligibleForRank = (
    profile: any,
    rank: 'HANG_NHAT' | 'HANG_NHI' | 'HANG_BA'
  ): boolean => {
    if (!profile) return false;
    if (rank === 'HANG_NHAT') {
      return profile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    } else if (rank === 'HANG_NHI') {
      return profile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    } else if (rank === 'HANG_BA') {
      return profile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    }

    return false;
  };

  /** Returns the highest HCBVTQ rank the personnel qualifies for. */
  const getHighestEligibleAward = (profile: any): string | undefined => {
    if (checkEligibleForRank(profile, 'HANG_NHAT')) {
      return 'HCBVTQ_HANG_NHAT';
    } else if (checkEligibleForRank(profile, 'HANG_NHI')) {
      return 'HCBVTQ_HANG_NHI';
    } else if (checkEligibleForRank(profile, 'HANG_BA')) {
      return 'HCBVTQ_HANG_BA';
    }
    return undefined;
  };

  const getDanhHieuOptions = () => {
    return [
      { label: 'Huân chương Bảo vệ Tổ quốc Hạng Ba', value: 'HCBVTQ_HANG_BA' },
      { label: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì', value: 'HCBVTQ_HANG_NHI' },
      { label: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất', value: 'HCBVTQ_HANG_NHAT' },
    ];
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
          HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',
          HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
          HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
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
      render: (_: any, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.7'),
    },
    {
      title: 'Tổng thời gian (0.8)',
      key: 'total_time_0_8',
      width: 150,
      align: 'center',
      render: (_: any, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.8'),
    },
    {
      title: 'Tổng thời gian (0.9-1.0)',
      key: 'total_time_0_9_1_0',
      width: 150,
      align: 'center',
      render: (_: any, record: Personnel) => calculateTotalTimeByGroup(record.id, '0.9-1.0'),
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
        message="Hướng dẫn"
        description={
          <div>
            <p>
              1. Chọn danh hiệu khen thưởng cho từng quân nhân đã chọn (
              <strong>{personnel.length}</strong> quân nhân)
            </p>
            <p style={{ marginTop: 8, paddingLeft: 16, borderLeft: '3px solid #1890ff' }}>
              <strong>Lưu ý cho đề xuất Huân chương Bảo vệ Tổ quốc:</strong>
              <br />- Yêu cầu thời gian: <strong>Nam: 10 năm (120 tháng)</strong>,{' '}
              <strong>Nữ: 6 năm 8 tháng (80 tháng)</strong> - giảm 1/3 thời gian
              <br />
              - Hạng Nhất: cần từ nhóm hệ số 0.9-1.0
              <br />
              - Hạng Nhì: cần từ nhóm hệ số 0.8 + 0.9-1.0 (hạng cao cộng vào)
              <br />- Hạng Ba: cần từ nhóm hệ số 0.7 + 0.8 + 0.9-1.0 (tất cả hạng cao cộng vào)
            </p>
            <p>2. Đảm bảo tất cả quân nhân đều đã được chọn danh hiệu</p>
            <p>3. Sau khi hoàn tất, nhấn &quot;Tiếp tục&quot; để sang bước upload file</p>
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
            Năm {nam}
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
