'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Select,
  Alert,
  Typography,
  Space,
  message,
  Button,
  Modal,
  Tabs,
  Tag,
  Input,
  Empty,
} from 'antd';
import { EditOutlined, HistoryOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { PersonnelRewardHistoryModal } from './PersonnelRewardHistoryModal';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import { MILITARY_RANKS } from '@/constants/militaryRanks.constants';
import {
  PROPOSAL_STATUS_COLORS,
  getProposalStatusLabel,
  PROPOSAL_TYPES,
} from '@/constants/proposal.constants';

const { Text } = Typography;

const CSTDCS_DANH_HIEU_LABELS: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua cơ sở',
  CSTT: 'Chiến sĩ thi đua',
};

const NCKH_LOAI_LABELS: Record<string, string> = {
  NCKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

const NHOM_CSTDCS_CSTT = new Set(['CSTDCS', 'CSTT']);
const NHOM_CHUOI = new Set(['BKBQP', 'CSTDTQ', 'BKTTCP']);
const MIXED_GROUP_WARNING =
  'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. ' +
  'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.';

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  cap_bac?: string;
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

interface PersonnelAnnualProfile {
  tong_cstdcs: CSTDCSItem[];
  tong_nckh: NCKHItem[];
}

interface TitleData {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

interface AnnualProfile {
  tong_cstdcs: number;
  tong_cstdcs_json?: CSTDCSItem[];
  cstdcs_lien_tuc?: number;
  tong_nckh: number;
  tong_nckh_json?: NCKHItem[];
  du_dieu_kien_bkbqp?: boolean;
  du_dieu_kien_cstdtq?: boolean;
  du_dieu_kien_bkttcp?: boolean;
  goi_y?: string | null;
}

interface CSTDCSItem {
  nam: number;
  danh_hieu: string;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  [key: string]: any;
}

interface NCKHItem {
  nam: number;
  loai: string;
  mo_ta: string;
  status?: string;
  so_quyet_dinh?: string | null;
  [key: string]: any;
}

interface Step3SetTitlesCaNhanHangNamProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
}

type DanhHieuGroup = 'nhom_cstdcs_cstt' | 'nhom_chuoi' | null;

export function Step3SetTitlesCaNhanHangNam({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
}: Step3SetTitlesCaNhanHangNamProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [loadingModal] = useState(false);
  const [selectedAnnualProfile, setSelectedAnnualProfile] = useState<AnnualProfile | null>(null);
  const [annualProfiles, setAnnualProfiles] = useState<Record<string, any>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    if (selectedPersonnelIds.length === 0) {
      setPersonnel([]);
      onTitleDataChange([]);
      return;
    }
    fetchData();
  }, [selectedPersonnelIds]);

  const fetchData = async () => {
    const hideMessage = message.loading('Đang tải dữ liệu và tính toán hồ sơ...', 0);
    try {
      setLoading(true);
      setLoadingProfiles(true);

      const [personnelResponses, profileResults] = await Promise.all([
        Promise.all(selectedPersonnelIds.map(id => apiClient.getPersonnelById(id))),
        Promise.all(
          selectedPersonnelIds.map(id =>
            apiClient.getAnnualProfile(id, nam)
              .then(res => ({ id, res }))
              .catch(() => ({ id, res: null }))
          )
        ),
      ]);

      const personnelData = personnelResponses.filter(r => r.success).map(r => r.data);
      setPersonnel(personnelData);

      if (titleData.length === 0) {
        onTitleDataChange(personnelData.map((p: Personnel) => ({
          personnel_id: p.id,
          cap_bac: p.cap_bac || '',
          chuc_vu: p.ChucVu?.ten_chuc_vu || '',
        })));
      } else {
        const updatedData = titleData.map(item => {
          const p = personnelData.find((pd: Personnel) => pd.id === item.personnel_id);
          if (p && (!item.cap_bac || !item.chuc_vu)) {
            return { ...item, cap_bac: item.cap_bac || p.cap_bac || '', chuc_vu: item.chuc_vu || p.ChucVu?.ten_chuc_vu || '' };
          }
          return item;
        });
        if (JSON.stringify(updatedData) !== JSON.stringify(titleData)) {
          onTitleDataChange(updatedData);
        }
      }

      const map: Record<string, any> = {};
      profileResults.forEach((r: any) => {
        if (r?.res?.success && r.res.data) map[r.id] = r.res.data;
        else map[r.id] = null;
      });
      setAnnualProfiles(prev => ({ ...prev, ...map }));

      hideMessage();
      message.success('Nhập dữ liệu và tính toán hồ sơ hoàn tất!');
    } catch {
      hideMessage();
      message.error('Có lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
      setLoadingProfiles(false);
    }
  };

  const getDanhHieuGroup = (danhHieu?: string | null): DanhHieuGroup => {
    if (!danhHieu) return null;
    if (NHOM_CSTDCS_CSTT.has(danhHieu)) return 'nhom_cstdcs_cstt';
    if (NHOM_CHUOI.has(danhHieu)) return 'nhom_chuoi';
    return null;
  };

  const getSelectedDanhHieuType = (): DanhHieuGroup => {
    const selectedDanhHieus = titleData.map(item => item.danh_hieu).filter(Boolean);

    if (selectedDanhHieus.length === 0) return null;

    return getDanhHieuGroup(selectedDanhHieus[0]);
  };

  const getDanhHieuOptions = (id: string) => {
    const selectedType = getSelectedDanhHieuType();
    let allOptions = [
      { label: 'Chiến sĩ thi đua cơ sở', value: 'CSTDCS' },
      { label: 'Chiến sĩ tiên tiến', value: 'CSTT' },
      { label: 'Bằng khen của Bộ trưởng Bộ Quốc phòng', value: 'BKBQP' },
      { label: 'Chiến sĩ thi đua toàn quân', value: 'CSTDTQ' },
      { label: 'Bằng khen Thủ tướng Chính phủ', value: 'BKTTCP' },
    ];
    if (annualProfiles[id]) {
      const profile = annualProfiles[id];
      if (profile.du_dieu_kien_bkbqp === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKBQP');
      }
      if (profile.du_dieu_kien_cstdtq === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'CSTDTQ');
      }
      if (profile.du_dieu_kien_bkttcp === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKTTCP');
      }

    }

    if (selectedType === 'nhom_cstdcs_cstt') {
      return allOptions.filter(opt => opt.value === 'CSTDCS' || opt.value === 'CSTT');
    } else if (selectedType === 'nhom_chuoi') {
      return allOptions.filter(
        opt => opt.value === 'BKBQP' || opt.value === 'CSTDTQ' || opt.value === 'BKTTCP'
      );
    }

    return allOptions;
  };

  const checkAlreadyReceived = (id: string, danhHieu: string): boolean => {
    const profile = annualProfiles[id];
    if (!profile) return false;
    const yearRecords: CSTDCSItem[] = profile.tong_cstdcs_json || [];
    const thisYear = yearRecords.find((r: CSTDCSItem) => r.nam === nam);
    if (!thisYear) return false;
    if (danhHieu === 'BKBQP' && thisYear.nhan_bkbqp) return true;
    if (danhHieu === 'CSTDTQ' && thisYear.nhan_cstdtq) return true;
    if (danhHieu === 'BKTTCP' && thisYear.nhan_bkttcp) return true;
    return false;
  };

  const updateTitle = async (id: string, field: string, value: any) => {
    if (field === 'danh_hieu' && value) {
      if (checkAlreadyReceived(id, value)) {
        const p = personnel.find(p => p.id === id);
        const label = getDanhHieuOptions(id).find(opt => opt.value === value)?.label || value;
        message.error(`${p?.ho_ten || 'Quân nhân'} đã nhận ${label} năm ${nam}`);
        return;
      }

      const selectedType = getSelectedDanhHieuType();
      const selectedGroup = getSelectedDanhHieuType();
      const valueGroup = getDanhHieuGroup(value);

      if (
        selectedGroup &&
        valueGroup &&
        selectedGroup !== valueGroup &&
        selectedType === 'nhom_cstdcs_cstt'
      ) {
        const currentData = titleData.find(d => d.personnel_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(MIXED_GROUP_WARNING);
          return;
        }
      } else if (selectedGroup && valueGroup && selectedGroup !== valueGroup && selectedType === 'nhom_chuoi') {
        const currentData = titleData.find(d => d.personnel_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(MIXED_GROUP_WARNING);
          return;
        }
      }
    }

    if (field === 'danh_hieu' && value) {
      const personnelDetail = personnel.find(p => p.id === id);
      if (personnelDetail) {
        try {
          const isMutuallyExclusive = value === 'CSTDCS' || value === 'CSTT';
          const results = await Promise.all([
            apiClient.checkDuplicate({
              personnel_id: id,
              nam,
              danh_hieu: value,
              proposal_type: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
            }),
            ...(isMutuallyExclusive
              ? [
                  apiClient.checkDuplicate({
                    personnel_id: id,
                    nam,
                    danh_hieu: value === 'CSTDCS' ? 'CSTT' : 'CSTDCS',
                    proposal_type: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
                  }),
                ]
              : []),
          ]);
          const conflict = results.find(r => r.success && r.data.exists);
          if (conflict) {
            message.error(
              `${personnelDetail.ho_ten}: ${conflict.data.message}. Không thể đề xuất danh hiệu này.`
            );
            return;
          }
        } catch (error: unknown) {
          // Don't block on API error — just log
        }
      }
    }

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

  const handleViewDetails = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setModalVisible(true);
    setSelectedAnnualProfile(annualProfiles[record.id]);
  };

  const handleViewHistory = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setHistoryModalVisible(true);
    setSelectedAnnualProfile(annualProfiles[record.id]);
  };

  const columns: ColumnsType<Personnel> = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, record, index) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleViewDetails(record)}
          onMouseEnter={e => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {index + 1}
        </span>
      ),
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
            loading={loadingProfiles}
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
          onClick={() => handleViewHistory(record)}
          size="small"
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];

  const hasDuplicateAward = personnel.some(p => {
    const data = getTitleData(p.id);
    return data.danh_hieu && checkAlreadyReceived(p.id, data.danh_hieu);
  });

  const allTitlesSet = !hasDuplicateAward && personnel.every(p => {
    const data = getTitleData(p.id);
    return data.danh_hieu;
  });

  return (
    <div>
      <Alert
        message="Bước 3: Thiết lập danh hiệu - Cá nhân hằng năm"
        description={
          <div>
            <p>
              1. Thiết lập danh hiệu cho từng quân nhân đã chọn (
              <strong>{personnel.length}</strong> quân nhân)
            </p>
            <p>
              2. Quy tắc nghiệp vụ: không đề xuất CSTDCS/CSTT cùng BKBQP/CSTDTQ/BKTTCP trong cùng
              một hồ sơ; BKBQP/CSTDTQ/BKTTCP có thể đi cùng nhau.
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
            {
              titleData.filter(
                d => d.danh_hieu && d.personnel_id && selectedPersonnelIds.includes(d.personnel_id)
              ).length
            }
            /{personnel.length}
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

      {/* Modal xem danh hiệu và NCKH */}
      <Modal
        title={
          <span>
            <EyeOutlined /> Thông tin danh hiệu và NCKH - {selectedPersonnel?.ho_ten}{' '}
            {selectedPersonnel?.ngay_sinh ? (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ({formatDate(selectedPersonnel.ngay_sinh)})
              </Text>
            ) : null}
          </span>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedPersonnel(null);
          setSelectedAnnualProfile(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setModalVisible(false);
              setSelectedPersonnel(null);
              setSelectedAnnualProfile(null);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={800}
        loading={loadingModal}
      >
        {selectedAnnualProfile && (
          <Tabs
            items={[
              {
                key: 'CSTDCS',
                label: `Danh hiệu CSTDCS (${selectedAnnualProfile.tong_cstdcs})`,
                children: (
                  <div>
                    {selectedAnnualProfile.tong_cstdcs > 0 ? (
                      <Table<CSTDCSItem>
                        dataSource={selectedAnnualProfile.tong_cstdcs_json}
                        rowKey={(record, index) => `${record.nam}-${index}`}
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                        columns={[
                          {
                            title: 'Năm',
                            dataIndex: 'nam',
                            key: 'nam',
                            width: 100,
                            align: 'center',
                          },
                          {
                            title: 'Danh hiệu',
                            dataIndex: 'danh_hieu',
                            key: 'danh_hieu',
                            width: 150,
                            align: 'center',
                            render: text => CSTDCS_DANH_HIEU_LABELS[text as string] || text,
                          },
                          {
                            title: 'Nhận BKBQP',
                            dataIndex: 'nhan_bkbqp',
                            key: 'nhan_bkbqp',
                            width: 120,
                            align: 'center',
                            render: value =>
                              value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>,
                          },
                          {
                            title: 'Nhận CSTDTQ',
                            dataIndex: 'nhan_cstdtq',
                            key: 'nhan_cstdtq',
                            width: 120,
                            align: 'center',
                            render: value =>
                              value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>,
                          },
                          {
                            title: 'Nhận BKTTCP',
                            dataIndex: 'nhan_bkttcp',
                            key: 'nhan_bkttcp',
                            width: 120,
                            align: 'center',
                            render: value =>
                              value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>,
                          },
                          {
                            title: 'Số quyết định',
                            key: 'so_quyet_dinh',
                            width: 200,
                            align: 'center',
                            render: (_, record) => {
                              const decisions = [];
                              if (record.so_quyet_dinh_bkbqp) {
                                decisions.push(`BKBQP: ${record.so_quyet_dinh_bkbqp}`);
                              }
                              if (record.so_quyet_dinh_cstdtq) {
                                decisions.push(`CSTDTQ: ${record.so_quyet_dinh_cstdtq}`);
                              }
                              return decisions.length > 0 ? (
                                <div style={{ textAlign: 'left' }}>
                                  {decisions.map((d, i) => (
                                    <div key={i}>{d}</div>
                                  ))}
                                </div>
                              ) : (
                                '-'
                              );
                            },
                          },
                        ]}
                      />
                    ) : (
                      <Text type="secondary">Chưa có danh hiệu CSTDCS</Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'nckh',
                label: `NCKH (${
                  Array.isArray(selectedAnnualProfile.tong_nckh)
                    ? selectedAnnualProfile.tong_nckh.length
                    : 0
                })`,
                children: (
                  <div>
                    {selectedAnnualProfile.tong_nckh > 0 ? (
                      <Table<NCKHItem>
                        dataSource={selectedAnnualProfile.tong_nckh_json}
                        rowKey={(record, index) => `${record.nam}-${index}`}
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                        columns={[
                          {
                            title: 'Năm',
                            dataIndex: 'nam',
                            key: 'nam',
                            width: 100,
                            align: 'center',
                          },
                          {
                            title: 'Loại',
                            dataIndex: 'loai',
                            key: 'loai',
                            width: 150,
                            align: 'center',
                            render: text => NCKH_LOAI_LABELS[text as string] || text,
                          },
                          {
                            title: 'Mô tả',
                            dataIndex: 'mo_ta',
                            key: 'mo_ta',
                            align: 'left',
                          },
                          {
                            title: 'Trạng thái',
                            dataIndex: 'status',
                            key: 'status',
                            width: 120,
                            align: 'center',
                            render: (status: string) => (
                              <Tag color={PROPOSAL_STATUS_COLORS[status] || 'default'}>
                                {getProposalStatusLabel(status)}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Số QĐ',
                            dataIndex: 'so_quyet_dinh',
                            key: 'so_quyet_dinh',
                            width: 150,
                            align: 'center',
                            render: text => text || '-',
                          },
                        ]}
                      />
                    ) : (
                      <Text type="secondary">Chưa có thành tích NCKH</Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
        {!selectedAnnualProfile && !loadingModal && (
          <Text type="secondary">Không có dữ liệu hồ sơ hằng năm</Text>
        )}
      </Modal>

      <PersonnelRewardHistoryModal
        visible={historyModalVisible}
        personnel={selectedPersonnel}
        annualProfile={selectedAnnualProfile}
        loading={loadingModal}
        onClose={() => {
          setHistoryModalVisible(false);
          setSelectedPersonnel(null);
          setSelectedAnnualProfile(null);
        }}
      />
    </div>
  );
}
