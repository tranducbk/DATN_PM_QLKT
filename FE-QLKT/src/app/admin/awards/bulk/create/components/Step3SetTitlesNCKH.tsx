'use client';

import { useState, useEffect } from 'react';
import { Table, Select, Input, Alert, Typography, Space, Button, Modal, Tabs, Tag, Empty } from 'antd';
import { EditOutlined, HistoryOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import ScientificAchievementHistoryModal from './ScientificAchievementHistoryModal';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { PROPOSAL_STATUS, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/constants/proposal.constants';

const { Text } = Typography;
const { TextArea } = Input;

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

interface TitleData {
  personnel_id?: string;
  loai?: 'DTKH' | 'SKKH';
  mo_ta?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

interface NCKHItem {
  nam: number;
  loai: string;
  mo_ta: string;
  status?: string;
  so_quyet_dinh?: string | null;
  [key: string]: any;
}

interface Step3SetTitlesNCKHProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  nam: number;
}

export default function Step3SetTitlesNCKH({
  selectedPersonnelIds,
  onPersonnelChange,
  titleData,
  onTitleDataChange,
  nam,
}: Step3SetTitlesNCKHProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [scientificAchievementHistoryModalVisible, setScientificAchievementHistoryModalVisible] =
    useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [annualProfile, setAnnualProfile] = useState<any>(null);
  const [scientificAchievements, setScientificAchievements] = useState<any[]>([]);
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

      // Initialize title data if empty
      if (titleData.length === 0) {
        const initialData = personnelData.map((p: Personnel) => ({
          personnel_id: p.id,
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
      // Error handled by UI
    } finally {
      setLoading(false);
    }
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

  const getTitleData = (id: string) => {
    return titleData.find(d => d.personnel_id === id) || { personnel_id: id };
  };

  const handleViewDetails = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setLoadingModal(true);
    setModalVisible(true);

    try {
      const profileRes = await apiClient.getAnnualProfile(record.id, nam);
      if (profileRes.success && profileRes.data) {
        setAnnualProfile(profileRes.data);
      } else {
        setAnnualProfile(null);
      }
    } catch (error: unknown) {
      // Error handled by UI
      setAnnualProfile(null);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleViewHistory = async (record: Personnel) => {
    setSelectedPersonnel(record);
    setLoadingModal(true);
    setScientificAchievementHistoryModalVisible(true);

    try {
      const achievementsRes = await apiClient.getPersonnelScientificAchievements(record.id);
      if (achievementsRes.success && achievementsRes.data) {
        setScientificAchievements(Array.isArray(achievementsRes.data) ? achievementsRes.data : []);
      } else {
        setScientificAchievements([]);
      }
    } catch (error: unknown) {
      // Error handled by UI
      setScientificAchievements([]);
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
          Loại <Text type="danger">*</Text>
        </span>
      ),
      key: 'loai',
      width: 160,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <Select
            value={data.loai}
            onChange={value => updateTitle(record.id, 'loai', value)}
            placeholder="Chọn loại"
            style={{ width: '100%', height: 32, fontSize: '14px' }}
            size="middle"
            popupMatchSelectWidth={false}
            styles={{ popup: { root: { minWidth: 'max-content' } } }}
            options={[
              { label: 'Đề tài khoa học (ĐTKH)', value: 'DTKH' },
              { label: 'Sáng kiến khoa học (SKKH)', value: 'SKKH' },
            ]}
          />
        );
      },
    },
    {
      title: (
        <span>
          Mô tả <Text type="danger">*</Text>
        </span>
      ),
      key: 'mo_ta',
      width: 400,
      align: 'center',
      render: (_, record) => {
        const data = getTitleData(record.id);
        return (
          <TextArea
            value={data.mo_ta}
            onChange={e => updateTitle(record.id, 'mo_ta', e.target.value)}
            placeholder="Nhập mô tả..."
            rows={1}
            maxLength={500}
            showCount
            style={{ width: '100%', height: 32, fontSize: '14px' }}
          />
        );
      },
    },
    {
      title: 'Xem lịch sử',
      key: 'history',
      width: 150,
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
    return data.loai && data.mo_ta;
  });

  return (
    <div>
      <Alert
        message="Hướng dẫn"
        description={
          <div>
            <p>
              1. Chọn loại và nhập mô tả cho từng quân nhân đã chọn (
              <strong>{personnel.length}</strong> quân nhân)
            </p>
            <p>2. Đảm bảo tất cả quân nhân đều đã được chọn loại và nhập mô tả</p>
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
          Đã set thông tin:{' '}
          <strong>
            {titleData.filter(d => d.loai && d.mo_ta).length}/{personnel.length}
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
          pageSize: 10,
          showSizeChanger: true,
        }}
        bordered
        locale={{
          emptyText: <Empty description="Không có dữ liệu" />,
        }}
      />

      {/* Modal xem danh hiệu và NCKH */}
      <Modal
        title={
          <span>
            <EyeOutlined /> Thông tin NCKH/SKKH - {selectedPersonnel?.ho_ten}
          </span>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedPersonnel(null);
          setAnnualProfile(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setModalVisible(false);
              setSelectedPersonnel(null);
              setAnnualProfile(null);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={800}
        loading={loadingModal}
      >
        {annualProfile && (
          <Tabs
            items={[
              {
                key: 'nckh',
                label: `NCKH/SKKH (${
                  Array.isArray(annualProfile.tong_nckh) ? annualProfile.tong_nckh.length : 0
                })`,
                children: (
                  <div>
                    {Array.isArray(annualProfile.tong_nckh) &&
                    annualProfile.tong_nckh.length > 0 ? (
                      <Table<NCKHItem>
                        dataSource={annualProfile.tong_nckh}
                        rowKey={(record, index) => `${record.nam}-${index}`}
                        pagination={false}
                        size="small"
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
                            render: text => {
                              const map: Record<string, string> = {
                                NCKH: 'Đề tài khoa học',
                                SKKH: 'Sáng kiến khoa học',
                              };
                              return map[text] || text;
                            },
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
                            render: (status: string) => {
                              const color = PROPOSAL_STATUS_COLORS[status] || 'orange';
                              const text = PROPOSAL_STATUS_LABELS[status] || status;
                              return <Tag color={color}>{text}</Tag>;
                            },
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
                      <Text type="secondary">Chưa có thành tích NCKH/SKKH</Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
        {!annualProfile && !loadingModal && (
          <Text type="secondary">Không có dữ liệu hồ sơ hằng năm</Text>
        )}
      </Modal>

      <ScientificAchievementHistoryModal
        visible={scientificAchievementHistoryModalVisible}
        personnel={selectedPersonnel}
        achievements={scientificAchievements}
        loading={loadingModal}
        onClose={() => {
          setScientificAchievementHistoryModalVisible(false);
          setSelectedPersonnel(null);
          setScientificAchievements([]);
        }}
      />
    </div>
  );
}
