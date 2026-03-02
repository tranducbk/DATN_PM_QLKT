'use client';

import { useState, useEffect } from 'react';
import { Table, Select, Alert, Typography, Space, Tag, Button, message } from 'antd';
import { EditOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api-client';
import UnitAnnualAwardHistoryModal from './UnitAnnualAwardHistoryModal';
import axiosInstance from '@/utils/axiosInstance';

const { Text } = Typography;

interface Unit {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  co_quan_don_vi_id?: string;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
}

interface TitleData {
  don_vi_id?: string;
  don_vi_type?: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  danh_hieu?: string;
}

interface Step3SetTitlesDonViHangNamProps {
  selectedUnitIds: string[];
  onUnitChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
}

export default function Step3SetTitlesDonViHangNam({
  selectedUnitIds,
  onUnitChange,
  titleData,
  onTitleDataChange,
  nam,
}: Step3SetTitlesDonViHangNamProps) {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitAnnualAwardHistoryModalVisible, setUnitAnnualAwardHistoryModalVisible] =
    useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitAnnualAwards, setUnitAnnualAwards] = useState<any>(null);
  const [allUnitAnnualAwards, setAllUnitAnnualAwards] = useState<Record<string, any>>({});
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    if (selectedUnitIds.length > 0) {
      fetchUnitDetails();
      fetchUnitAnnualProfiles();
    } else {
      setUnits([]);
      onTitleDataChange([]);
    }
  }, [selectedUnitIds]);

  const fetchUnitDetails = async () => {
    try {
      setLoading(true);
      // Admin cần lấy tất cả đơn vị, không chỉ my-units
      const unitsRes = await apiClient.getUnits();

      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];
        // Select units that are returned from /api/units
        const selectedUnits = unitsData.filter((unit: any) => selectedUnitIds.includes(unit.id));

        const formattedUnits: Unit[] = selectedUnits.map((unit: any) => ({
          id: unit.id,
          ten_don_vi: unit.ten_don_vi,
          ma_don_vi: unit.ma_don_vi,
          co_quan_don_vi_id: unit.co_quan_don_vi_id,
          CoQuanDonVi: unit.CoQuanDonVi || null,
        }));

        setUnits(formattedUnits);

        // Initialize title data if empty
        if (titleData.length === 0 && formattedUnits.length > 0) {
          const initialData: TitleData[] = formattedUnits.map((unit: Unit) => ({
            don_vi_id: unit.id,
            don_vi_type: (unit.co_quan_don_vi_id ? 'DON_VI_TRUC_THUOC' : 'CO_QUAN_DON_VI') as
              | 'CO_QUAN_DON_VI'
              | 'DON_VI_TRUC_THUOC',
          }));
          onTitleDataChange(initialData);
        }
      }
    } catch (error) {
      console.error('Error fetching unit details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnitAnnualProfiles = async () => {
    if (!selectedUnitIds || selectedUnitIds.length === 0) return;
    const hideMessage = message.loading('Đang tính toán lại hồ sơ đơn vị...', 0);
    try {
      const profilesMap: Record<string, any> = {};
      await Promise.all(
        selectedUnitIds.map(async unitId => {
          try {
            const profileRes = await apiClient.getUnitAnnualProfile(unitId, nam);
            if (profileRes.success && profileRes.data) {
              profilesMap[unitId] = profileRes.data;
            } else {
              profilesMap[unitId] = null;
            }
          } catch (e) {
            profilesMap[unitId] = null;
          }
        })
      );
      setAllUnitAnnualAwards(profilesMap);
      hideMessage();
      message.success('Tính toán hồ sơ hoàn tất!');
    } catch (error) {
      console.error('Error fetching unit annual profiles:', error);
      hideMessage();
      message.error('Có lỗi khi tính toán hồ sơ');
    }
  };

  const getSelectedDanhHieuType = () => {
    const selectedDanhHieus = titleData.map(item => item.danh_hieu).filter(Boolean);
    if (selectedDanhHieus.length === 0) return null;

    const hasDonVi = selectedDanhHieus.some(dh => dh === 'ĐVQT' || dh === 'ĐVTT');
    const hasBk = selectedDanhHieus.some(dh => dh === 'BKBQP' || dh === 'BKTTCP');

    if (hasDonVi) return 'donvi';
    if (hasBk) return 'bkbqp_bkttcp';
    return null;
  };

  const getDanhHieuOptions = (id: string) => {
    const selectedType = getSelectedDanhHieuType();
    let allOptions = [
      { label: 'Đơn vị Quyết thắng', value: 'ĐVQT' },
      { label: 'Đơn vị Tiên tiến', value: 'ĐVTT' },
      { label: 'Bằng khen của Bộ trưởng Bộ Quốc phòng', value: 'BKBQP' },
      { label: 'Bằng khen Thủ tướng Chính phủ', value: 'BKTTCP' },
    ];

    // Use prefetched annual profile for this unit to determine eligibility
    const profile = allUnitAnnualAwards[id];
    if (profile) {
      // profile.du_dieu_kien_bk_tong_cuc -> eligible for BKBQP (3 years)
      if (profile.du_dieu_kien_bk_tong_cuc === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKBQP');
      }
      // profile.du_dieu_kien_bk_thu_tuong -> eligible for BKTTCP (5 years)
      if (profile.du_dieu_kien_bk_thu_tuong === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKTTCP');
      }
    }

    if (selectedType === 'donvi') {
      return allOptions.filter(opt => opt.value === 'ĐVQT' || opt.value === 'ĐVTT');
    }

    if (selectedType === 'bkbqp_bkttcp') {
      return allOptions.filter(opt => opt.value === 'BKBQP' || opt.value === 'BKTTCP');
    }

    return allOptions;
  };

  const updateTitle = async (id: string, field: string, value: any) => {
    // Validation: Kiểm tra nếu đang chọn danh hiệu và đã có danh hiệu khác loại
    if (field === 'danh_hieu' && value) {
      const selectedType = getSelectedDanhHieuType();
      const isDonVi = value === 'ĐVQT' || value === 'ĐVTT';
      const isBk = value === 'BKBQP' || value === 'BKTTCP';

      // Kiểm tra xem có mix ĐVQT/ĐVTT với BKBQP/BKTTCP không
      if (selectedType === 'donvi' && isBk) {
        // Đã có ĐVQT/ĐVTT, không cho phép thêm BKBQP/BKTTCP
        const currentData = titleData.find(d => d.don_vi_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(
            'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. ' +
              'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.'
          );
          return;
        }
      } else if (selectedType === 'bkbqp_bkttcp' && isDonVi) {
        // Đã có BKBQP/BKTTCP, không cho phép thêm ĐVQT/ĐVTT
        const currentData = titleData.find(d => d.don_vi_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(
            'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. ' +
              'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.'
          );
          return;
        }
      }
    }

    // Kiểm tra đề xuất trùng: cùng năm và cùng danh hiệu
    if (field === 'danh_hieu' && value) {
      const unitDetail = units.find(u => u.id === id);
      if (unitDetail) {
        try {
          if (value === 'ĐVQT' || value === 'ĐVTT') {
            // Kiểm tra thêm cho ĐVQT/ĐVTT
            const response = await axiosInstance.get('/api/proposals/check-duplicate-unit', {
              params: {
                don_vi_id: id,
                nam: nam,
                danh_hieu: value === 'ĐVQT' ? 'ĐVTT' : 'ĐVQT',
                proposal_type: 'DON_VI_HANG_NAM',
              },
            });
            if (response.data.success && response.data.data.exists) {
              message.error(
                `${unitDetail.ten_don_vi}: ${response.data.data.message}. Không thể đề xuất danh hiệu này.`
              );
              return; // Không cho phép chọn
            }
          }

          // Kiểm tra cho danh hiệu chính
          const response = await axiosInstance.get('/api/proposals/check-duplicate-unit', {
            params: {
              don_vi_id: id,
              nam: nam,
              danh_hieu: value,
              proposal_type: 'DON_VI_HANG_NAM',
            },
          });

          if (response.data.success && response.data.data.exists) {
            message.error(
              `${unitDetail.ten_don_vi}: ${response.data.data.message}. Không thể đề xuất danh hiệu này.`
            );
            return; // Không cho phép chọn
          }
        } catch (error: any) {
          console.error('Error checking duplicate unit award:', error);
          // Không block nếu lỗi API, chỉ log
        }
      }
    }

    const newData = [...titleData];
    const index = newData.findIndex(d => d.don_vi_id === id);
    if (index >= 0) {
      newData[index] = { ...newData[index], [field]: value };
    } else {
      const unit = units.find(u => u.id === id);
      newData.push({
        don_vi_id: id,
        don_vi_type: unit?.co_quan_don_vi_id ? 'DON_VI_TRUC_THUOC' : 'CO_QUAN_DON_VI',
        [field]: value,
      });
    }

    onTitleDataChange(newData);
  };

  const getTitleData = (id: string) => {
    return titleData.find(d => d.don_vi_id === id) || { don_vi_id: id };
  };

  const handleViewUnitHistory = async (record: Unit) => {
    setSelectedUnit(record);
    setLoadingModal(true);
    setUnitAnnualAwardHistoryModalVisible(true);

    try {
      // Sử dụng dữ liệu đã fetch từ allUnitAnnualAwards (getUnitAnnualProfile)
      const profile = allUnitAnnualAwards[record.id];
      if (profile) {
        setUnitAnnualAwards(profile);
      } else {
        setUnitAnnualAwards([]);
      }
    } catch (error: any) {
      console.error('Error loading unit history:', error);
      setUnitAnnualAwards([]);
    } finally {
      setLoadingModal(false);
    }
  };

  const columns: ColumnsType<Unit> = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Loại đơn vị',
      key: 'type',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const type = record.co_quan_don_vi_id ? 'DON_VI_TRUC_THUOC' : 'CO_QUAN_DON_VI';
        return (
          <Tag color={type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
            {type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
          </Tag>
        );
      },
    },
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 140,
      align: 'center',
      render: text => <Text code>{text}</Text>,
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      width: 200,
      align: 'center',
      render: text => <Text strong>{text}</Text>,
    },
    {
      title: (
        <span>
          Danh hiệu <Text type="danger">*</Text>
        </span>
      ),
      key: 'danh_hieu',
      width: 250,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        const availableOptions = getDanhHieuOptions(record.id);

        return (
          <Select
            value={data.danh_hieu}
            disabled={availableOptions.length === 0}
            onChange={value => updateTitle(record.id, 'danh_hieu', value)}
            placeholder="Chọn danh hiệu"
            style={{ width: '100%' }}
            size="middle"
            allowClear
            popupMatchSelectWidth={false}
            styles={{ popup: { root: { minWidth: 'max-content' } } }}
            options={availableOptions}
          />
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
          onClick={() => handleViewUnitHistory(record)}
          size="small"
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];

  const allTitlesSet = units.every(u => {
    const data = getTitleData(u.id);
    return data.danh_hieu;
  });

  return (
    <div>
      <Alert
        message="Hướng dẫn"
        description={
          <div>
            <p>
              1. Chọn danh hiệu khen thưởng cho từng đơn vị đã chọn (<strong>{units.length}</strong>{' '}
              đơn vị)
            </p>
            <p>
              2. <strong>Lưu ý:</strong> Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một
              đề xuất. BKBQP và BKTTCP có thể đề xuất cùng nhau.
            </p>
            <p>3. Đảm bảo tất cả đơn vị đều đã được chọn danh hiệu</p>
            <p>4. Sau khi hoàn tất, nhấn &quot;Tiếp tục&quot; để sang bước upload file</p>
          </div>
        }
        type="info"
        showIcon
        icon={<EditOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Space direction="vertical" style={{ marginBottom: 16, width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text type="secondary">
              Tổng số đơn vị: <strong>{units.length}</strong>
            </Text>
            <br />
            <Text type={allTitlesSet ? 'success' : 'warning'}>
              Đã thêm danh hiệu:{' '}
              <strong>
                {titleData.filter(d => d.danh_hieu).length}/{units.length}
              </strong>
              {allTitlesSet && ' ✓'}
            </Text>
          </div>
        </div>
      </Space>

      <Table<Unit>
        columns={columns}
        dataSource={units}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedUnitIds,
          onChange: (selectedRowKeys: React.Key[]) => {
            onUnitChange(selectedRowKeys as string[]);
            // Xóa dữ liệu danh hiệu của các đơn vị bị bỏ chọn
            const newTitleData = titleData.filter(d =>
              (selectedRowKeys as string[]).includes(d.don_vi_id || '')
            );
            onTitleDataChange(newTitleData);
          },
        }}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
        bordered
        locale={{
          emptyText: 'Không có dữ liệu',
        }}
      />

      <UnitAnnualAwardHistoryModal
        visible={unitAnnualAwardHistoryModalVisible}
        unit={selectedUnit}
        annualAwards={unitAnnualAwards}
        loading={loadingModal}
        onClose={() => {
          setUnitAnnualAwardHistoryModalVisible(false);
          setSelectedUnit(null);
          setUnitAnnualAwards(null);
        }}
      />
    </div>
  );
}
