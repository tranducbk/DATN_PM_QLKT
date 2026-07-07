'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, Select, InputNumber, Space, Typography, Table, message, Input, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { getApiErrorMessage } from '@/lib/http/apiError';
import {
  AWARD_TAB_LABELS,
  AWARD_TAB_FILENAME,
  INDIVIDUAL_AWARD_TABS,
  type AwardType,
} from '@/constants/danhHieu.constants';
import { MODAL_TABLE_PREVIEW_PAGE_SIZE, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';

const { Text } = Typography;

/** Personnel preview rows loaded by selected unit. */
interface ExportPersonnelPreviewRow {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  chuc_vu_name?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
}

/** Unit rows shown in the selection table. */
interface ExportUnitPreviewRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
}

interface ExportModalProps {
  open: boolean;
  onCancel: () => void;
  activeTab: AwardType;
}

export function ExportModal({ open, onCancel, activeTab }: ExportModalProps) {
  const currentYear = new Date().getFullYear();
  const [tuNam, setTuNam] = useState<number | null>(null);
  const [denNam, setDenNam] = useState<number | null>(null);
  const [danhHieu, setDanhHieu] = useState<string | undefined>(undefined);
  const [donViId, setDonViId] = useState<string | undefined>(undefined);
  const [units, setUnits] = useState<{ id: string; ten_don_vi: string; ma_don_vi?: string }[]>([]);
  const [exporting, setExporting] = useState(false);

  const [personnelList, setPersonnelList] = useState<ExportPersonnelPreviewRow[]>([]);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  const [searchPersonnelText, setSearchPersonnelText] = useState('');
  const [searchUnitText, setSearchUnitText] = useState('');

  const filteredPersonnelList = useMemo(() => {
    if (!searchPersonnelText) return personnelList;
    const lower = searchPersonnelText.toLowerCase().trim();
    return personnelList.filter(p => p.ho_ten?.toLowerCase().includes(lower));
  }, [personnelList, searchPersonnelText]);

  const filteredUnitsList = useMemo(() => {
    if (!searchUnitText) return units;
    const lower = searchUnitText.toLowerCase().trim();
    return units.filter(
      u =>
        u.ten_don_vi?.toLowerCase().includes(lower) ||
        u.ma_don_vi?.toLowerCase().includes(lower)
    );
  }, [units, searchUnitText]);

  useEffect(() => {
    if (open) {
      setTuNam(null);
      setDenNam(null);
      setDanhHieu(undefined);
      setDonViId(undefined);
      setPersonnelList([]);
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setSearchPersonnelText('');
      setSearchUnitText('');
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;
    const loadUnits = async () => {
      try {
        const unitsResponse = await apiClient.getUnits();
        if (unitsResponse.success) {
          setUnits(unitsResponse.data ?? []);
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Không thể tải danh sách đơn vị'));
      }
    };
    loadUnits();
  }, [open]);

  useEffect(() => {
    if (!open || !INDIVIDUAL_AWARD_TABS.includes(activeTab)) {
      setPersonnelList([]);
      return;
    }
    const fetchPersonnel = async () => {
      try {
        setLoadingPersonnel(true);
        const params: Record<string, unknown> = {
          limit: FETCH_ALL_LIMIT,
        };
        if (donViId) {
          params.unit_id = donViId;
        }
        const personnelResponse = await apiClient.getPersonnel(params);
        if (personnelResponse.success) {
          const personnelRows = personnelResponse.data?.rows ?? personnelResponse.data ?? [];
          setPersonnelList(
            Array.isArray(personnelRows) ? (personnelRows as ExportPersonnelPreviewRow[]) : []
          );
        } else {
          setPersonnelList([]);
        }
      } catch {
        setPersonnelList([]);
      } finally {
        setLoadingPersonnel(false);
      }
    };
    fetchPersonnel();
  }, [donViId, open, activeTab]);

  const hasUnitFilter = activeTab !== 'DVHN'; // DVHN tab exports all units — no unit filter needed
  const isIndividualTab = INDIVIDUAL_AWARD_TABS.includes(activeTab);
  const isUnitTab = activeTab === 'DVHN';

  const handleExport = async () => {
    const isTuNamSet = tuNam !== null && tuNam !== undefined && String(tuNam).trim() !== '';
    const isDenNamSet = denNam !== null && denNam !== undefined && String(denNam).trim() !== '';

    if ((isTuNamSet && !isDenNamSet) || (!isTuNamSet && isDenNamSet)) {
      message.error('Vui lòng nhập đầy đủ cả Từ năm và Đến năm');
      return;
    }
    if (isTuNamSet && isDenNamSet && Number(tuNam) > Number(denNam)) {
      message.error('Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc');
      return;
    }

    try {
      setExporting(true);
      const params: Record<string, unknown> = {};

      if (tuNam) params.tu_nam = tuNam;
      if (denNam) params.den_nam = denNam;
      // Single-year selection uses the legacy nam param for backward compatibility.
      if (tuNam && denNam && tuNam === denNam) {
        params.nam = tuNam;
        delete params.tu_nam;
        delete params.den_nam;
      }
      if (tuNam && !denNam) {
        params.nam = tuNam;
        delete params.tu_nam;
      }
      if (!tuNam && denNam) {
        params.nam = denNam;
        delete params.den_nam;
      }
      if (danhHieu) params.danh_hieu = danhHieu;
      if (donViId) params.don_vi_id = donViId;

      if (selectedPersonnelIds.length > 0) {
        params.personnel_ids = selectedPersonnelIds.join(',');
      }
      if (selectedUnitIds.length > 0) {
        params.unit_ids = selectedUnitIds.join(',');
      }

      const exportFnMap: Record<string, (p: typeof params) => Promise<Blob>> = {
        CNHN: apiClient.exportAnnualRewards.bind(apiClient),
        DVHN: apiClient.exportUnitAnnualAwards.bind(apiClient),
        HCCSVV: apiClient.exportTenureMedals.bind(apiClient),
        HCBVTQ: apiClient.exportContributionMedals.bind(apiClient),
        KNC_VSNXD_QDNDVN: apiClient.exportCommemorationMedals.bind(apiClient),
        HCQKQT: apiClient.exportMilitaryFlag.bind(apiClient),
        NCKH: apiClient.exportScientificAchievements.bind(apiClient),
      };
      const exportFn = exportFnMap[activeTab] ?? apiClient.exportAwards.bind(apiClient);
      const blob = await exportFn(params);

      const baseFilename = AWARD_TAB_FILENAME[activeTab] ?? 'khen_thuong';
      const yearSuffix =
        tuNam && denNam && tuNam !== denNam
          ? `_${tuNam}-${denNam}`
          : tuNam
            ? `_${tuNam}`
            : denNam
              ? `_${denNam}`
              : '';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}${yearSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success('Xuất file thành công');
      onCancel();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Xuất file thất bại'));
    } finally {
      setExporting(false);
    }
  };



  // Personnel table columns
  const personnelColumns: ColumnsType<ExportPersonnelPreviewRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: ( value, record, index) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      ellipsis: true,
    },
    {
      title: 'Cấp bậc',
      key: 'cap_bac',
      width: 120,
      ellipsis: true,
      render: (value, record) => record.cap_bac ?? '-',
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 150,
      ellipsis: true,
      render: (value, record) =>
        record.ChucVu?.ten_chuc_vu ?? record.chuc_vu_name ?? '-',
    },
  ];

  const unitColumns: ColumnsType<ExportUnitPreviewRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: ( value, record, index) => index + 1,
    },
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 120,
      render: (val: string | undefined) => val ?? '-',
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      ellipsis: true,
    },
  ];

  return (
    <Modal
      title={`Xuất Excel — ${AWARD_TAB_LABELS[activeTab] ?? 'Khen thưởng'}`}
      open={open}
      onCancel={onCancel}
      onOk={handleExport}
      okText={exporting ? 'Đang xuất...' : 'Xuất file'}
      okButtonProps={{ loading: exporting, icon: <DownloadOutlined /> }}
      cancelText="Hủy"
      width="min(700px, calc(100vw - 32px))"
      centered
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
        {/* Year range */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Khoảng thời gian
          </Text>
          <Space>
            <InputNumber
              placeholder="Từ năm"
              min={1900}
              max={currentYear}
              value={tuNam}
              onChange={v => setTuNam(v)}
              style={{ width: 140 }}
            />
            <Text type="secondary">đến</Text>
            <InputNumber
              placeholder="Đến năm"
              min={tuNam ?? 1900}
              max={currentYear}
              value={denNam}
              onChange={v => setDenNam(v)}
              style={{ width: 140 }}
            />
          </Space>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            Bỏ trống để xuất tất cả các năm
          </Text>
        </div>

        {/* Unit */}
        {hasUnitFilter && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Đơn vị
            </Text>
            <Select
              placeholder="Tất cả đơn vị"
              allowClear
              showSearch
              optionFilterProp="label"
              value={donViId}
              onChange={v => setDonViId(v)}
              style={{ width: '100%' }}
              options={units.map(u => ({ value: u.id, label: u.ten_don_vi }))}
            />
          </div>
        )}

        {/* Personnel selection (individual tab) */}
        {isIndividualTab && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Chọn quân nhân (bỏ trống để xuất tất cả)</Text>
              {selectedPersonnelIds.length > 0 && (
                <Tag color="blue">Đã chọn: {selectedPersonnelIds.length}</Tag>
              )}
            </div>
            <Input
              placeholder="Tìm kiếm quân nhân theo họ tên..."
              value={searchPersonnelText}
              onChange={e => setSearchPersonnelText(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <Table
              size="small"
              rowKey="id"
              columns={personnelColumns}
              dataSource={filteredPersonnelList}
              loading={loadingPersonnel}
              pagination={{
                pageSize: MODAL_TABLE_PREVIEW_PAGE_SIZE,
                size: 'small',
                showLessItems: true,
              }}
              rowSelection={{
                selectedRowKeys: selectedPersonnelIds,
                onChange: keys => setSelectedPersonnelIds(keys as string[]),
                preserveSelectedRowKeys: true,
              }}
              scroll={{ y: 200 }}
            />
          </div>
        )}

        {/* Unit selection (unit tab) */}
        {isUnitTab && units.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Chọn đơn vị (bỏ trống để xuất tất cả)</Text>
              {selectedUnitIds.length > 0 && (
                <Tag color="blue">Đã chọn: {selectedUnitIds.length}</Tag>
              )}
            </div>
            <Input
              placeholder="Tìm kiếm đơn vị theo tên hoặc mã..."
              value={searchUnitText}
              onChange={e => setSearchUnitText(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <Table
              size="small"
              rowKey="id"
              columns={unitColumns}
              dataSource={filteredUnitsList}
              pagination={{
                pageSize: MODAL_TABLE_PREVIEW_PAGE_SIZE,
                size: 'small',
                showLessItems: true,
              }}
              rowSelection={{
                selectedRowKeys: selectedUnitIds,
                onChange: keys => setSelectedUnitIds(keys as string[]),
                preserveSelectedRowKeys: true,
              }}
              scroll={{ y: 200 }}
            />
          </div>
        )}

        {/* Fields 'Danh hiệu' and 'Loại thành tích' have been removed to default to exporting all titles */}
      </Space>
    </Modal>
  );
}
