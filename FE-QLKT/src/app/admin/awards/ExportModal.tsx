'use client';

import { useState, useEffect } from 'react';
import { Modal, Select, InputNumber, Space, Typography, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { DANH_HIEU_MAP } from '@/utils/awardsHelpers';
import {
  AWARD_TAB_LABELS,
  AWARD_TAB_DANH_HIEU,
  AWARD_TAB_FILENAME,
  INDIVIDUAL_AWARD_TABS,
  type AwardType,
} from '@/constants/danhHieu.constants';
import { MODAL_TABLE_PREVIEW_PAGE_SIZE } from '@/lib/constants/pagination.constants';

const { Text } = Typography;

/** Preview quân nhân (getPersonnel theo đơn vị). */
interface ExportPersonnelPreviewRow {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  chuc_vu_name?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
}

/** Đơn vị trong bảng chọn (cùng state `units`). */
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

  // Reset form khi đổi tab hoặc mở modal
  useEffect(() => {
    if (open) {
      setTuNam(null);
      setDenNam(null);
      setDanhHieu(undefined);
      setDonViId(undefined);
      setPersonnelList([]);
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
    }
  }, [open, activeTab]);

  // Load danh sách đơn vị
  useEffect(() => {
    if (!open) return;
    const loadUnits = async () => {
      try {
        const res = await apiClient.getUnits();
        if (res.success) {
          setUnits(res.data ?? []);
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Không thể tải danh sách đơn vị'));
      }
    };
    loadUnits();
  }, [open]);

  // Fetch personnel khi donViId thay đổi (chỉ cho tab cá nhân)
  useEffect(() => {
    if (!open || !INDIVIDUAL_AWARD_TABS.includes(activeTab)) {
      setPersonnelList([]);
      return;
    }
    if (!donViId) {
      setPersonnelList([]);
      setSelectedPersonnelIds([]);
      return;
    }
    const fetchPersonnel = async () => {
      try {
        setLoadingPersonnel(true);
        const res = await apiClient.getPersonnel({ unit_id: donViId, limit: 1000 });
        if (res.success) {
          const list = res.data?.rows ?? res.data ?? [];
          setPersonnelList(
            Array.isArray(list) ? (list as ExportPersonnelPreviewRow[]) : []
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
    setSelectedPersonnelIds([]);
  }, [donViId, open, activeTab]);

  const hasDanhHieuFilter = ['CNHN', 'DVHN', 'HCCSVV', 'HCBVTQ'].includes(activeTab);
  const hasUnitFilter = activeTab !== 'DVHN'; // Tab đơn vị không cần filter đơn vị
  const isIndividualTab = INDIVIDUAL_AWARD_TABS.includes(activeTab);
  const isUnitTab = activeTab === 'DVHN';

  const handleExport = async () => {
    // Validate khoảng năm
    if (tuNam && denNam && tuNam > denNam) {
      message.error('Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc');
      return;
    }

    try {
      setExporting(true);
      const params: Record<string, unknown> = {};

      if (tuNam) params.tu_nam = tuNam;
      if (denNam) params.den_nam = denNam;
      // Nếu chỉ chọn 1 năm, gửi param nam đơn lẻ cho API cũ
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

      // Add personnel/unit selection params
      if (selectedPersonnelIds.length > 0) {
        params.personnel_ids = selectedPersonnelIds.join(',');
      }
      if (selectedUnitIds.length > 0) {
        params.unit_ids = selectedUnitIds.join(',');
      }

      let blob: Blob;

      switch (activeTab) {
        case 'CNHN':
          blob = await apiClient.exportAnnualRewards(params);
          break;
        case 'DVHN':
          blob = await apiClient.exportUnitAnnualAwards(params);
          break;
        case 'HCCSVV':
          blob = await apiClient.exportHCCSVV(params);
          break;
        case 'HCBVTQ':
          blob = await apiClient.exportContributionAwards(params);
          break;
        case 'KNC_VSNXD_QDNDVN':
          blob = await apiClient.exportCommemorationMedals(params);
          break;
        case 'HCQKQT':
          blob = await apiClient.exportMilitaryFlag(params);
          break;
        case 'NCKH':
          blob = await apiClient.exportScientificAchievements(params);
          break;
        case 'KTDX':
        default:
          blob = await apiClient.exportAwards(params);
      }

      // Build filename
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

  const danhHieuList = AWARD_TAB_DANH_HIEU[activeTab] ?? [];

  // Personnel table columns
  const personnelColumns: ColumnsType<ExportPersonnelPreviewRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_value, _record, index) => index + 1,
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
      render: (_value, record) => record.cap_bac ?? '-',
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 150,
      ellipsis: true,
      render: (_value, record) =>
        record.ChucVu?.ten_chuc_vu ?? record.chuc_vu_name ?? '-',
    },
  ];

  const unitColumns: ColumnsType<ExportUnitPreviewRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_value, _record, index) => index + 1,
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
        {/* Khoảng năm */}
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

        {/* Đơn vị */}
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

        {/* Chọn quân nhân (cho tab cá nhân) */}
        {isIndividualTab && donViId && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Chọn quân nhân (bỏ trống để xuất tất cả)
            </Text>
            <Table
              size="small"
              rowKey="id"
              columns={personnelColumns}
              dataSource={personnelList}
              loading={loadingPersonnel}
              pagination={{
                pageSize: MODAL_TABLE_PREVIEW_PAGE_SIZE,
                size: 'small',
                showLessItems: true,
              }}
              rowSelection={{
                selectedRowKeys: selectedPersonnelIds,
                onChange: keys => setSelectedPersonnelIds(keys as string[]),
              }}
              scroll={{ y: 200 }}
            />
          </div>
        )}

        {/* Chọn đơn vị (cho tab đơn vị) */}
        {isUnitTab && units.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Chọn đơn vị (bỏ trống để xuất tất cả)
            </Text>
            <Table
              size="small"
              rowKey="id"
              columns={unitColumns}
              dataSource={units}
              pagination={{
                pageSize: MODAL_TABLE_PREVIEW_PAGE_SIZE,
                size: 'small',
                showLessItems: true,
              }}
              rowSelection={{
                selectedRowKeys: selectedUnitIds,
                onChange: keys => setSelectedUnitIds(keys as string[]),
              }}
              scroll={{ y: 200 }}
            />
          </div>
        )}

        {/* Danh hiệu */}
        {hasDanhHieuFilter && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Danh hiệu
            </Text>
            <Select
              placeholder="Tất cả danh hiệu"
              allowClear
              value={danhHieu}
              onChange={v => setDanhHieu(v)}
              style={{ width: '100%' }}
              options={danhHieuList.map(v => ({
                value: v,
                label: DANH_HIEU_MAP[v] ?? v,
              }))}
            />
          </div>
        )}

        {/* Loại thành tích khoa học */}
        {activeTab === 'NCKH' && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Loại thành tích
            </Text>
            <Select
              placeholder="Tất cả loại"
              allowClear
              value={danhHieu}
              onChange={v => setDanhHieu(v)}
              style={{ width: '100%' }}
              options={[
                { value: 'DTKH', label: 'Đề tài khoa học' },
                { value: 'SKKH', label: 'Sáng kiến khoa học' },
              ]}
            />
          </div>
        )}
      </Space>
    </Modal>
  );
}
