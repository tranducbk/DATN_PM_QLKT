'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Select, Typography, Space, Tag, Button, message, Empty } from 'antd';
import { EditOutlined, HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/http/apiClient';
import { getApiErrorMessage } from '@/lib/http/apiError';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { UnitAnnualAwardHistoryModal, type UnitAnnualAwards } from './UnitAnnualAwardHistoryModal';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_MAP,
  DANH_HIEU_OPTIONS,
  AWARD_TAB_LABELS,
} from '@/constants/danhHieu.constants';
import { StepGuide } from './StepGuide';
import { GUIDE_LINES, stepGuideTitle } from '@/constants/proposalStepGuides.constants';

const { Text } = Typography;

/** ĐVQT/ĐVTT group — never mixed with BKBQP/BKTTCP in one proposal. */
const UNIT_TITLE_DV = [
  DANH_HIEU_DON_VI_HANG_NAM.DVQT,
  DANH_HIEU_DON_VI_HANG_NAM.DVTT,
] as const;

/** BKBQP/BKTTCP group (codes shared with the personal code table). */
const UNIT_TITLE_BK = [
  DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
  DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
] as const;

const UNIT_TITLE_DV_SET = new Set<string>(UNIT_TITLE_DV);
const UNIT_TITLE_BK_SET = new Set<string>(UNIT_TITLE_BK);

const isUnitDvTitle = (code: string) => UNIT_TITLE_DV_SET.has(code);
const isUnitBkTitle = (code: string) => UNIT_TITLE_BK_SET.has(code);

const SELECTED_DANH_HIEU_MIX = {
  DON_VI: 'donvi',
  BK_PAIR: 'bkbqp_bkttcp',
} as const;

type SelectedDanhHieuMixType =
  (typeof SELECTED_DANH_HIEU_MIX)[keyof typeof SELECTED_DANH_HIEU_MIX] | null;

const MIX_DV_BK_WARNING =
  'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. ' +
  'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.';

const BASE_DON_VI_HANG_NAM_SELECT_OPTIONS = (DANH_HIEU_OPTIONS.DON_VI_HANG_NAM as readonly string[]).map(
  value => ({
    label: DANH_HIEU_MAP[value] ?? value,
    value,
  })
);

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

interface RawUnit {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  } | null;
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
  isManager?: boolean;
}

export function Step3SetTitlesDonViHangNam({
  selectedUnitIds,
  onUnitChange,
  titleData,
  onTitleDataChange,
  nam,
  isManager = false,
}: Step3SetTitlesDonViHangNamProps) {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitAnnualAwardHistoryModalVisible, setUnitAnnualAwardHistoryModalVisible] =
    useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitAnnualAwards, setUnitAnnualAwards] = useState<UnitAnnualAwards | null>(null);
  const [allUnitAnnualAwards, setAllUnitAnnualAwards] = useState<Record<string, UnitAnnualAwards | null>>({});
  const [loadingModal, setLoadingModal] = useState(false);

  const fetchUnitDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Manager only sees their own unit + sub-units; Admin fetches all units in the system.
      const unitsRes = isManager ? await apiClient.getMyUnits() : await apiClient.getUnits();

      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];
        // Select units that are returned from /api/units
        const rawUnits = unitsData as RawUnit[];
        const selectedUnits = rawUnits.filter(unit => selectedUnitIds.includes(unit.id));

        const formattedUnits: Unit[] = selectedUnits.map(unit => ({
          id: unit.id,
          ten_don_vi: unit.ten_don_vi,
          ma_don_vi: unit.ma_don_vi,
          co_quan_don_vi_id: unit.co_quan_don_vi_id ?? undefined,
          CoQuanDonVi: unit.CoQuanDonVi || undefined,
        }));

        setUnits(formattedUnits);

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
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitIds, onTitleDataChange]);

  const fetchUnitAnnualAwardss = useCallback(async () => {
    if (!selectedUnitIds || selectedUnitIds.length === 0) return;
    const hideMessage = message.loading('Đang tính toán lại hồ sơ đơn vị...', 0);
    try {
      const profilesMap: Record<string, UnitAnnualAwards | null> = {};
      await Promise.all(
        selectedUnitIds.map(async unitId => {
          try {
            const profileRes = await apiClient.getUnitAnnualProfile(unitId, nam);
            if (profileRes.success && profileRes.data) {
              profilesMap[unitId] = profileRes.data as UnitAnnualAwards;
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
      hideMessage();
      message.error('Có lỗi khi tính toán hồ sơ');
    }
  }, [selectedUnitIds, nam]);

  useEffect(() => {
    if (selectedUnitIds.length > 0) {
      fetchUnitDetails();
      fetchUnitAnnualAwardss();
    } else {
      setUnits([]);
      onTitleDataChange([]);
    }
  }, [selectedUnitIds, fetchUnitDetails, fetchUnitAnnualAwardss, onTitleDataChange]);

  const getSelectedDanhHieuType = (): SelectedDanhHieuMixType => {
    const selectedDanhHieus = titleData.map(item => item.danh_hieu).filter(Boolean) as string[];
    if (selectedDanhHieus.length === 0) return null;

    const hasDonVi = selectedDanhHieus.some(isUnitDvTitle);
    const hasBk = selectedDanhHieus.some(isUnitBkTitle);

    if (hasDonVi) return SELECTED_DANH_HIEU_MIX.DON_VI;
    if (hasBk) return SELECTED_DANH_HIEU_MIX.BK_PAIR;
    return null;
  };

  const getDanhHieuOptions = (id: string) => {
    const selectedType = getSelectedDanhHieuType();
    let allOptions = [...BASE_DON_VI_HANG_NAM_SELECT_OPTIONS];

    // Use prefetched annual profile for this unit to determine eligibility
    const profile = allUnitAnnualAwards[id];
    if (profile) {
      // du_dieu_kien_bkbqp -> eligible for unit BKBQP (2-year ĐVQT cycle)
      if (profile.du_dieu_kien_bkbqp === false) {
        allOptions = allOptions.filter(
          opt => opt.value !== DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
        );
      }
      // du_dieu_kien_bkttcp -> eligible for unit BKTTCP (7-year ĐVQT cycle)
      if (profile.du_dieu_kien_bkttcp === false) {
        allOptions = allOptions.filter(
          opt => opt.value !== DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
        );
      }

    }

    if (selectedType === SELECTED_DANH_HIEU_MIX.DON_VI) {
      return allOptions.filter(opt => isUnitDvTitle(opt.value));
    }

    if (selectedType === SELECTED_DANH_HIEU_MIX.BK_PAIR) {
      return allOptions.filter(opt => isUnitBkTitle(opt.value));
    }

    return allOptions;
  };

  const checkAlreadyReceived = (id: string, danhHieu: string): boolean => {
    const profile = allUnitAnnualAwards[id];
    if (!profile) return false;
    const yearRecords = profile.tong_dvqt_json || [];
    const thisYear = yearRecords.find(r => r.nam === nam);
    if (!thisYear) return false;
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && thisYear.nhan_bkbqp) return true;
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && thisYear.nhan_bkttcp) return true;
    return false;
  };

  const updateTitle = async (id: string, field: string, value: string) => {
    if (field === 'danh_hieu' && value) {
      if (checkAlreadyReceived(id, value)) {
        const u = units.find(u => u.id === id);
        const label = getDanhHieuOptions(id).find(opt => opt.value === value)?.label || value;
        message.error(`${u?.ten_don_vi || 'Đơn vị'} đã nhận ${label} năm ${nam}`);
        return;
      }

      const selectedType = getSelectedDanhHieuType();
      const valueStr = String(value);
      const pickingDv = isUnitDvTitle(valueStr);
      const pickingBk = isUnitBkTitle(valueStr);

      if (selectedType === SELECTED_DANH_HIEU_MIX.DON_VI && pickingBk) {
        const currentData = titleData.find(d => d.don_vi_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(MIX_DV_BK_WARNING);
          return;
        }
      } else if (selectedType === SELECTED_DANH_HIEU_MIX.BK_PAIR && pickingDv) {
        const currentData = titleData.find(d => d.don_vi_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(MIX_DV_BK_WARNING);
          return;
        }
      }
    }

    if (field === 'danh_hieu' && value) {
      const unitDetail = units.find(u => u.id === id);
      if (unitDetail) {
        try {
          const results = await Promise.all([
            apiClient.checkDuplicateUnit({
              don_vi_id: id,
              nam,
              danh_hieu: value,
              proposal_type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
            }),
            ...(isUnitDvTitle(value)
              ? [
                  apiClient.checkDuplicateUnit({
                    don_vi_id: id,
                    nam,
                    danh_hieu:
                      value === DANH_HIEU_DON_VI_HANG_NAM.DVQT
                        ? DANH_HIEU_DON_VI_HANG_NAM.DVTT
                        : DANH_HIEU_DON_VI_HANG_NAM.DVQT,
                    proposal_type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
                  }),
                ]
              : []),
          ]);
          const conflict = results.find(r => r.success && r.data.exists);
          if (conflict) {
            message.error(
              `${unitDetail.ten_don_vi}: ${conflict.data.message}. Không thể đề xuất danh hiệu này.`
            );
            return;
          }
        } catch (error: unknown) {
          // Don't block on API error — just log
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
    setUnitAnnualAwardHistoryModalVisible(true);

    const cached = allUnitAnnualAwards[record.id];
    if (cached) {
      setUnitAnnualAwards(cached);
      setLoadingModal(false);
      return;
    }

    setLoadingModal(true);
    try {
      const res = await apiClient.getUnitAnnualProfile(record.id, nam);
      setUnitAnnualAwards(res.success && res.data ? res.data : null);
    } catch {
      setUnitAnnualAwards(null);
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

  const hasDuplicateAward = units.some(u => {
    const data = getTitleData(u.id);
    return data.danh_hieu && checkAlreadyReceived(u.id, data.danh_hieu);
  });

  const allTitlesSet = !hasDuplicateAward && units.every(u => {
    const data = getTitleData(u.id);
    return data.danh_hieu;
  });

  return (
    <div>
      <StepGuide
        title={stepGuideTitle(3, 'Thiết lập danh hiệu', AWARD_TAB_LABELS.DVHN)}
        icon={<EditOutlined />}
        steps={[
          <span key="0">
            Thiết lập danh hiệu cho <strong>{units.length}</strong> đơn vị đã chọn.
          </span>,
          'Quy tắc nghiệp vụ: không đề xuất ĐVQT/ĐVTT cùng BKBQP/BKTTCP trong cùng một hồ sơ; BKBQP và BKTTCP có thể đi cùng nhau.',
          GUIDE_LINES.allUnitsHaveTitle,
          GUIDE_LINES.nextToAttach,
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space size="middle" align="center">
          <Tag color="red" style={{ fontSize: 14, padding: '4px 12px', margin: 0 }}>
            Năm {nam}
          </Tag>
          <Text type="secondary">
            Tổng số đơn vị: <strong>{units.length}</strong>
          </Text>
        </Space>
        <Text type={allTitlesSet ? 'success' : 'warning'}>
          Đã thêm danh hiệu:{' '}
          <strong>
            {titleData.filter(d => d.danh_hieu).length}/{units.length}
          </strong>
          {allTitlesSet && ' ✓'}
        </Text>
      </div>

      <Table<Unit>
        columns={columns}
        dataSource={units}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedUnitIds,
          onChange: (selectedRowKeys: React.Key[]) => {
            onUnitChange(selectedRowKeys as string[]);
            const newTitleData = titleData.filter(d =>
              (selectedRowKeys as string[]).includes(d.don_vi_id || '')
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
