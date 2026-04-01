'use client';

import { useState, useEffect } from 'react';
import { Table, Select, Alert, Typography, Space, Tag, message, Button, Input, Empty } from 'antd';
import { EditOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { ServiceHistoryModal } from './ServiceHistoryModal';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import type { DateInput } from '@/lib/types';

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

interface Step3SetTitlesNienHanProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
  bypassEligibility?: boolean;
}

export function Step3SetTitlesNienHan({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
  bypassEligibility = false,
}: Step3SetTitlesNienHanProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [serviceProfilesMap, setServiceProfilesMap] = useState<Record<string, any>>({});
  const [serviceHistoryModalVisible, setServiceHistoryModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [serviceProfile, setServiceProfile] = useState<any>(null);
  const [loadingModal, setLoadingModal] = useState(false);

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

      // Fetch service profiles
      const profilesMap: Record<string, any> = {};

      await Promise.all(
        personnelData.map(async p => {
          if (p.id) {
            try {
              const res = await apiClient.getTenureProfile(p.id);
              if (res.success && res.data) {
                profilesMap[p.id] = res.data;
              }
            } catch (error) {
              profilesMap[p.id] = null;
            }
          }
        })
      );

      setServiceProfilesMap(profilesMap);

      // Initialize title data if empty
      if (titleData.length === 0) {
        const initialData = personnelData.map((p: Personnel) => ({
          personnel_id: p.id,
          danh_hieu: getHighestEligibleAwardNienHan(p, profilesMap[p.id]),
          cap_bac: p.cap_bac || '',
          chuc_vu: p.ChucVu?.ten_chuc_vu || '',
        }));
        onTitleDataChange(initialData);
      } else {
        // Cập nhật cap_bac và chuc_vu nếu chưa có
        const updatedData = titleData.map(item => {
          const p = personnelData.find((pd: Personnel) => pd.id === item.personnel_id);
          if (p && (!item.cap_bac || !item.chuc_vu)) {
            return {
              ...item,
              cap_bac: item.cap_bac || p.cap_bac || '',
              chuc_vu: item.chuc_vu || p.ChucVu?.ten_chuc_vu || '',
            };
          }
          return item;
        });
        if (JSON.stringify(updatedData) !== JSON.stringify(titleData)) {
          onTitleDataChange(updatedData);
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

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
        : new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return null;
      }

      let years = endDate.getFullYear() - startDate.getFullYear();
      let months = endDate.getMonth() - startDate.getMonth();
      let days = endDate.getDate() - startDate.getDate();

      if (days < 0) {
        months -= 1;
        const lastDayOfPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
        days += lastDayOfPrevMonth;
      }

      if (months < 0) {
        years -= 1;
        months += 12;
      }

      const totalMonths = years * 12 + months;
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

  // Kiểm tra điều kiện thời gian cho HCCSVV
  const checkHCCSVVEligibilityForPersonnel = (record: Personnel) => {
    if (!record.ngay_nhap_ngu) return null;

    const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
    if (!result) return null;

    const currentDate = new Date();
    const startDate =
      typeof record.ngay_nhap_ngu === 'string'
        ? new Date(record.ngay_nhap_ngu)
        : record.ngay_nhap_ngu;

    // Tính ngày đủ điều kiện cho từng hạng
    const eligibilityDateBa = new Date(startDate);
    eligibilityDateBa.setFullYear(eligibilityDateBa.getFullYear() + 10);
    const eligibilityYearBa = eligibilityDateBa.getFullYear();

    const eligibilityDateNhi = new Date(startDate);
    eligibilityDateNhi.setFullYear(eligibilityDateNhi.getFullYear() + 15);
    const eligibilityYearNhi = eligibilityDateNhi.getFullYear();

    const eligibilityDateNhat = new Date(startDate);
    eligibilityDateNhat.setFullYear(eligibilityDateNhat.getFullYear() + 20);
    const eligibilityYearNhat = eligibilityDateNhat.getFullYear();

    const currentYear = currentDate.getFullYear();

    return {
      hangBa: currentYear >= eligibilityYearBa,
      hangNhi: currentYear >= eligibilityYearNhi,
      hangNhat: currentYear >= eligibilityYearNhat,
    };
  };

  const getHighestEligibleAwardNienHan = (
    record: Personnel,
    serviceProfile: any
  ): string | undefined => {
    if (serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN) {
      return 'HCCSVV_HANG_NHAT';
    }
    if (serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN) {
      return 'HCCSVV_HANG_NHI';
    }
    if (serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN) {
      return 'HCCSVV_HANG_BA';
    }
    return undefined;
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

  const handleViewHistory = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setLoadingModal(true);
    setServiceHistoryModalVisible(true);

    try {
      const profileRes = await apiClient.getTenureProfile(record.id);
      if (profileRes.success && profileRes.data) {
        setServiceProfile(profileRes.data);
      } else {
        setServiceProfile(null);
      }
    } catch (error: unknown) {
      message.error('Không thể tải lịch sử niên hạn');
      setServiceProfile(null);
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
      render: (date: string | undefined | null) => formatDate(date),
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
      render: (_: any, record: Personnel) => {
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
          HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
          HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
          HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',
        };

        if (bypassEligibility) {
          const eligibility = checkHCCSVVEligibilityForPersonnel(record);
          const isNotEligible =
            data.danh_hieu &&
            eligibility &&
            ((data.danh_hieu === 'HCCSVV_HANG_BA' && !eligibility.hangBa) ||
              (data.danh_hieu === 'HCCSVV_HANG_NHI' && !eligibility.hangNhi) ||
              (data.danh_hieu === 'HCCSVV_HANG_NHAT' && !eligibility.hangNhat));

          return (
            <div>
              <Select
                value={data.danh_hieu || undefined}
                onChange={value => updateTitle(record.id, 'danh_hieu', value)}
                placeholder="Chọn danh hiệu"
                style={{ width: '100%' }}
                size="middle"
                status={isNotEligible ? 'warning' : undefined}
                options={[
                  { value: 'HCCSVV_HANG_BA', label: 'Hạng Ba' },
                  { value: 'HCCSVV_HANG_NHI', label: 'Hạng Nhì' },
                  { value: 'HCCSVV_HANG_NHAT', label: 'Hạng Nhất' },
                ]}
              />
              {isNotEligible && (
                <Text type="danger" style={{ fontSize: '11px' }}>
                  Chưa đủ điều kiện thời gian
                </Text>
              )}
            </div>
          );
        }

        return (
          <Text strong style={{ color: !data.danh_hieu ? '#ff4d4f' : undefined }}>
            {data.danh_hieu ? awardLabels[data.danh_hieu] || data.danh_hieu : 'Chưa xác định'}
          </Text>
        );
      },
    },
    {
      title: 'Xem lịch sử khen thưởng',
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
              1. Danh hiệu khen thưởng sẽ được tự động xác định dựa trên thời gian phục vụ và lịch
              sử khen thưởng cho từng quân nhân đã chọn (<strong>{personnel.length}</strong> quân
              nhân)
            </p>
            <p>
              2. <strong>Yêu cầu thời gian:</strong> Hạng Ba: 10 năm, Hạng Nhì: 15 năm, Hạng Nhất:
              20 năm
            </p>
            <p>
              3. <strong>Lưu ý:</strong> Phải nhận từ thấp lên cao: Hạng Ba → Hạng Nhì → Hạng Nhất
            </p>
            <p>4. Đảm bảo tất cả quân nhân đều đã được xác định danh hiệu</p>
            <p>5. Sau khi hoàn tất, nhấn &quot;Tiếp tục&quot; để sang bước upload file</p>
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
            // Xóa dữ liệu danh hiệu của các quân nhân bị bỏ chọn
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
        locale={{
          emptyText: <Empty description="Không có dữ liệu" />,
        }}
      />

      <ServiceHistoryModal
        visible={serviceHistoryModalVisible}
        personnel={selectedPersonnel}
        serviceProfile={serviceProfile}
        loading={loadingModal}
        onClose={() => {
          setServiceHistoryModalVisible(false);
          setSelectedPersonnel(null);
          setServiceProfile(null);
        }}
      />
    </div>
  );
}
