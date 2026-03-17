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
} from 'antd';
import { EditOutlined, HistoryOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosInstance from '@/utils/axiosInstance';
import { apiClient } from '@/lib/api-client';
import PersonnelRewardHistoryModal from './PersonnelRewardHistoryModal';
import { formatDate } from '@/lib/utils';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';

const { Text } = Typography;

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

export default function Step3SetTitlesCaNhanHangNam({
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
  const [loadingModal, setLoadingModal] = useState(false);
  const [selectedAnnualProfile, setSelectedAnnualProfile] = useState<any>(null);
  const [annualProfiles, setAnnualProfiles] = useState<Record<string, any>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    if (selectedPersonnelIds.length > 0) {
      fetchPersonnelDetails();
      fetchAnnualProfiles();
    } else {
      setPersonnel([]);
      onTitleDataChange([]);
    }
  }, [selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      setLoading(true);
      const promises = selectedPersonnelIds.map(id => axiosInstance.get(`/api/personnel/${id}`));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);
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
      console.error('Error fetching personnel details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnualProfiles = async () => {
    if (!selectedPersonnelIds || selectedPersonnelIds.length === 0) return;
    const hideMessage = message.loading('Đang tính toán lại hồ sơ hằng năm...', 0);
    try {
      setLoadingProfiles(true);
      const promises = selectedPersonnelIds.map(id =>
        apiClient
          .getAnnualProfile(id, nam)
          .then(res => ({ id, res }))
          .catch(err => ({ id, res: null }))
      );
      const results = await Promise.all(promises);
      const map: Record<string, any> = {};
      results.forEach((r: any) => {
        if (r && r.res && r.res.success && r.res.data) {
          map[r.id] = r.res.data;
        } else {
          map[r.id] = null;
        }
      });
      setAnnualProfiles(prev => ({ ...prev, ...map }));
      hideMessage();
      message.success('Tính toán hồ sơ hoàn tất!');
    } catch (error) {
      console.error('Error prefetching annual profiles:', error);
      hideMessage();
      message.error('Có lỗi khi tính toán hồ sơ');
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Xác định loại danh hiệu đã được chọn trong đề xuất
  const getSelectedDanhHieuType = () => {
    const selectedDanhHieus = titleData.map(item => item.danh_hieu).filter(Boolean);

    if (selectedDanhHieus.length === 0) return null;

    // Kiểm tra xem có CSTDCS/CSTT không
    const hasChinh = selectedDanhHieus.some(dh => dh === 'CSTDCS' || dh === 'CSTT');
    const hasBKBQP = selectedDanhHieus.some(dh => dh === 'BKBQP');
    const hasCSTDTQ = selectedDanhHieus.some(dh => dh === 'CSTDTQ');

    if (hasChinh) {
      return 'chinh'; // CSTDCS/CSTT
    } else if (hasBKBQP || hasCSTDTQ) {
      return 'bkbqp_cstdtq'; // BKBQP và CSTDTQ có thể cùng nhau
    }
    return null;
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
      if (annualProfiles[id].du_dieu_kien_bkbqp === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKBQP');
      }
      if (annualProfiles[id].du_dieu_kien_cstdtq === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'CSTDTQ');
      }
      if (annualProfiles[id].du_dieu_kien_bkttcp === false) {
        allOptions = allOptions.filter(opt => opt.value !== 'BKTTCP');
      }
    }

    // Nếu đã chọn CSTDCS/CSTT, chỉ hiển thị CSTDCS/CSTT
    // Nếu đã chọn BKBQP/CSTDTQ, có thể chọn cả BKBQP và CSTDTQ
    if (selectedType === 'chinh') {
      return allOptions.filter(opt => opt.value === 'CSTDCS' || opt.value === 'CSTT');
    } else if (selectedType === 'bkbqp_cstdtq') {
      return allOptions.filter(opt => opt.value === 'BKBQP' || opt.value === 'CSTDTQ');
    }

    return allOptions;
  };

  const updateTitle = async (id: string, field: string, value: any) => {
    // Validation: Kiểm tra nếu đang chọn danh hiệu và đã có danh hiệu khác loại
    if (field === 'danh_hieu' && value) {
      const selectedType = getSelectedDanhHieuType();
      const isChinh = value === 'CSTDCS' || value === 'CSTT';
      const isBKBQP_CSTDTQ = value === 'BKBQP' || value === 'CSTDTQ';

      // Kiểm tra xem có mix CSTDCS/CSTT với BKBQP/CSTDTQ không
      if (selectedType === 'chinh' && isBKBQP_CSTDTQ) {
        // Đã có CSTDCS/CSTT, không cho phép thêm BKBQP/CSTDTQ
        const currentData = titleData.find(d => d.personnel_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(
            'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ trong một đề xuất. ' +
              'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.'
          );
          return;
        }
      } else if (selectedType === 'bkbqp_cstdtq' && isChinh) {
        // Đã có BKBQP/CSTDTQ, không cho phép thêm CSTDCS/CSTT
        const currentData = titleData.find(d => d.personnel_id === id);
        if (!currentData || !currentData.danh_hieu) {
          message.warning(
            'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ trong một đề xuất. ' +
              'Vui lòng tạo đề xuất riêng cho loại danh hiệu này.'
          );
          return;
        }
      }
    }

    // Kiểm tra đề xuất trùng: cùng năm và cùng danh hiệu
    if (field === 'danh_hieu' && value) {
      const personnelDetail = personnel.find(p => p.id === id);
      if (personnelDetail) {
        try {
          const response = await axiosInstance.get('/api/proposals/check-duplicate', {
            params: {
              personnel_id: id,
              nam: nam,
              danh_hieu: value,
              proposal_type: 'CA_NHAN_HANG_NAM',
            },
          });

          if (value === 'CSTDCS' || value === 'CSTT') {
            // Kiểm tra thêm cho CSTDCS/CSTT
            const response = await axiosInstance.get('/api/proposals/check-duplicate', {
              params: {
                personnel_id: id,
                nam: nam,
                danh_hieu: value === 'CSTDCS' ? 'CSTT' : 'CSTDCS',
                proposal_type: 'CA_NHAN_HANG_NAM',
              },
            });
            if (response.data.success && response.data.data.exists) {
              message.error(
                `${personnelDetail.ho_ten}: ${response.data.data.message}. Không thể đề xuất danh hiệu này.`
              );
              return; // Không cho phép chọn
            }
          }

          if (response.data.success && response.data.data.exists) {
            message.error(
              `${personnelDetail.ho_ten}: ${response.data.data.message}. Không thể đề xuất danh hiệu này.`
            );
            return; // Không cho phép chọn
          }
        } catch (error: any) {
          console.error('Error checking duplicate award:', error);
          // Không block nếu lỗi API, chỉ log
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
            <p>
              2. <strong>Lưu ý:</strong> Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ trong
              một đề xuất. BKBQP và CSTDTQ có thể đề xuất cùng nhau.
            </p>
            <p>3. Đảm bảo tất cả quân nhân đều đã được chọn danh hiệu</p>
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
              Tổng số quân nhân: <strong>{personnel.length}</strong>
            </Text>
          </div>
          <div>
            <Text type={allTitlesSet ? 'success' : 'warning'}>
              Đã thêm danh hiệu:{' '}
              <strong>
                {titleData.filter(d => selectedPersonnelIds.includes(d.personnel_id)).length}/
                {personnel.length}
              </strong>
              {allTitlesSet && ' ✓'}
            </Text>
          </div>
        </div>
      </Space>
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
          emptyText: 'Không có dữ liệu',
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
                            render: text => {
                              const map: Record<string, string> = {
                                CSTDCS: 'Chiến sĩ thi đua cơ sở',
                                CSTT: 'Chiến sĩ thi đua',
                              };
                              return map[text] || text;
                            },
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
                label: `NCKH/SKKH (${
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
                            render: status => {
                              const color = status === 'APPROVED' ? 'green' : 'orange';
                              const text = status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt';
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
