'use client';

import { useState, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Spin,
  message,
  Modal,
  Select,
  InputNumber,
  Input,
  Upload,
  Steps,
  Alert,
  AutoComplete,
  DatePicker,
  Descriptions,
  Card,
} from 'antd';
import dayjs from 'dayjs';
import {
  FileOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import type {
  Personnel,
  Unit,
  CreateFormData,
  DecisionAutocompleteRow,
} from './types';
import { INITIAL_CREATE_FORM, RANK_OPTIONS } from './types';

const { Text } = Typography;
const { TextArea } = Input;

interface CreateAdhocAwardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  personnel: Personnel[];
  units: Unit[];
  subUnits: Unit[];
}

export function CreateAdhocAwardModal({
  open,
  onClose,
  onSuccess,
  personnel,
  units,
  subUnits,
}: CreateAdhocAwardModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFormData>(INITIAL_CREATE_FORM);
  const [createAttachedFileList, setCreateAttachedFileList] = useState<UploadFile[]>([]);
  const [personnelFilters, setPersonnelFilters] = useState({
    coQuanId: '',
    donViId: '',
    searchName: '',
  });
  const [unitFilters, setUnitFilters] = useState({ type: 'ALL' });

  const [decisionOptions, setDecisionOptions] = useState<{ value: string; label: string }[]>([]);
  const [searchingDecision, setSearchingDecision] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<DecisionAutocompleteRow | null>(null);

  const handleSearchDecision = useCallback(async (value: string) => {
    if (!value || value.trim().length === 0) {
      setDecisionOptions([]);
      return;
    }

    try {
      setSearchingDecision(true);
      const res = await apiClient.autocompleteDecisions(
        value.trim(),
        10,
        PROPOSAL_TYPES.DOT_XUAT
      );
      if (res.success && res.data) {
        setDecisionOptions(
          (res.data as DecisionAutocompleteRow[]).map(item => ({
            value: item.so_quyet_dinh,
            label: `${item.so_quyet_dinh} - ${item.nguoi_ky} (${formatDate(item.ngay_ky)})`,
          }))
        );
      } else {
        setDecisionOptions([]);
      }
    } catch {
      setDecisionOptions([]);
    } finally {
      setSearchingDecision(false);
    }
  }, []);

  const handleDecisionSelect = useCallback(async (value: string) => {
    try {
      const res = await apiClient.getDecisionBySoQuyetDinh(value);
      if (res.success && res.data) {
        const decision = res.data;
        setSelectedDecision(decision);
        setCreateFormData(prev => ({
          ...prev,
          decisionNumber: decision.so_quyet_dinh,
          decisionYear: decision.nam,
          signDate: dayjs(decision.ngay_ky).format('YYYY-MM-DD'),
          signer: decision.nguoi_ky,
        }));
        message.info('Đã tải thông tin quyết định từ hệ thống');
      }
    } catch {
      message.error('Lỗi khi tải thông tin quyết định');
    }
  }, []);

  const handleClose = () => {
    setCreateFormData(INITIAL_CREATE_FORM);
    setCreateAttachedFileList([]);
    setSelectedDecision(null);
    setDecisionOptions([]);
    setPersonnelFilters({ coQuanId: '', donViId: '', searchName: '' });
    setUnitFilters({ type: 'ALL' });
    onClose();
  };

  const validateCreateStep = (step: number): boolean => {
    const { awardForm, year, type, personnelIds, unitIds } = createFormData;

    switch (step) {
      case 0:
        if (!awardForm || !year) {
          message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
          return false;
        }
        return true;
      case 1:
        if (type === 'CA_NHAN' && personnelIds.length === 0) {
          message.error('Vui lòng chọn ít nhất một quân nhân');
          return false;
        }
        if (type === 'TAP_THE' && unitIds.length === 0) {
          message.error('Vui lòng chọn ít nhất một đơn vị');
          return false;
        }
        if (type === 'CA_NHAN') {
          const missingInfo = createFormData.personnelAwardInfo.filter(
            info => !info.rank || !info.position
          );
          if (missingInfo.length > 0) {
            const missingNames = missingInfo
              .map(info => personnel.find(p => p.id === info.personnelId)?.ho_ten)
              .filter(Boolean)
              .join(', ');
            message.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
            return false;
          }
        }
        return true;
      case 3:
        if (!createFormData.decisionNumber?.trim()) {
          message.error('Vui lòng nhập số quyết định');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleCreateSubmit = async () => {
    const { type, awardForm, year, personnelIds, unitIds, decisionNumber, note } = createFormData;

    if (!awardForm || !year) {
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    if (type === 'CA_NHAN' && personnelIds.length === 0) {
      message.error('Vui lòng chọn ít nhất một quân nhân');
      return;
    }

    if (type === 'TAP_THE' && unitIds.length === 0) {
      message.error('Vui lòng chọn ít nhất một đơn vị');
      return;
    }

    if (type === 'CA_NHAN') {
      const missingInfo = createFormData.personnelAwardInfo.filter(
        info => !info.rank || !info.position
      );
      if (missingInfo.length > 0) {
        const missingNames = missingInfo
          .map(info => personnel.find(p => p.id === info.personnelId)?.ho_ten)
          .filter(Boolean)
          .join(', ');
        message.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const targetIds = type === 'CA_NHAN' ? personnelIds : unitIds;

      for (const targetId of targetIds) {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('year', year.toString());
        formData.append('awardForm', awardForm);

        if (type === 'CA_NHAN') {
          formData.append('personnelId', targetId);
          const awardInfo = createFormData.personnelAwardInfo.find(
            info => info.personnelId === targetId
          );
          formData.append('rank', awardInfo?.rank || '');
          formData.append('position', awardInfo?.position || '');
        } else {
          const isCoQuan = units.find(u => u.id === targetId);
          const unitType = isCoQuan ? 'CO_QUAN_DON_VI' : 'DON_VI_TRUC_THUOC';
          formData.append('unitId', targetId);
          formData.append('unitType', unitType);
        }

        if (note) formData.append('note', note);
        if (decisionNumber) formData.append('decisionNumber', decisionNumber);

        createAttachedFileList.forEach(file => {
          if (file.originFileObj) {
            formData.append('attachedFiles', file.originFileObj);
          }
        });

        const res = await apiClient.createAdhocAward(formData);
        if (!res.success) {
          message.error(res.message || 'Thao tác thất bại');
          return;
        }
      }

      message.success(`Tạo thành công ${targetIds.length} khen thưởng đột xuất`);
      handleClose();
      onSuccess();
    } catch {
      message.error('Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPersonnel = personnel.filter(p => {
    if (personnelFilters.coQuanId && p.co_quan_don_vi_id !== personnelFilters.coQuanId)
      return false;
    if (personnelFilters.donViId && p.don_vi_truc_thuoc_id !== personnelFilters.donViId)
      return false;
    if (
      personnelFilters.searchName &&
      !p.ho_ten.toLowerCase().includes(personnelFilters.searchName.toLowerCase())
    )
      return false;
    return true;
  });

  const filteredUnits = [...units, ...subUnits].filter(u => {
    if (unitFilters.type === 'CO_QUAN' && subUnits.some(s => s.id === u.id)) return false;
    if (unitFilters.type === 'DON_VI' && units.some(s => s.id === u.id)) return false;
    return true;
  });

  const renderCreateStep = () => {
    const { currentStep, type } = createFormData;

    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Loại <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={type}
                onChange={value =>
                  setCreateFormData({
                    ...createFormData,
                    type: value,
                    personnelIds: [],
                    personnelAwardInfo: [],
                    unitIds: [],
                  })
                }
              >
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
              </Select>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Năm <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                value={createFormData.year}
                onChange={value =>
                  setCreateFormData({ ...createFormData, year: value || new Date().getFullYear() })
                }
                min={2000}
                max={2100}
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Hình thức khen thưởng <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Input
                size="large"
                value={createFormData.awardForm}
                onChange={e => setCreateFormData({ ...createFormData, awardForm: e.target.value })}
                placeholder='Ví dụ: "Giấy khen của HV", "Bằng khen của TC"'
              />
            </div>
          </Space>
        );

      case 1:
        return type === 'CA_NHAN' ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                Đã chọn:{' '}
                <strong style={{ color: '#1890ff' }}>{createFormData.personnelIds.length}</strong>{' '}
                quân nhân
              </Text>
            </div>
            <Space direction="vertical" size="small" style={{ marginBottom: 16, width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Cơ quan đơn vị</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={personnelFilters.coQuanId || undefined}
                    onChange={value =>
                      setPersonnelFilters({
                        ...personnelFilters,
                        coQuanId: value || '',
                        donViId: '',
                      })
                    }
                    allowClear
                    placeholder="Chọn cơ quan đơn vị"
                  >
                    {units.map(unit => (
                      <Select.Option key={unit.id} value={unit.id}>
                        {unit.ten_don_vi}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Đơn vị trực thuộc</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={personnelFilters.donViId || undefined}
                    onChange={value =>
                      setPersonnelFilters({ ...personnelFilters, donViId: value || '' })
                    }
                    disabled={!personnelFilters.coQuanId}
                    allowClear
                    placeholder="Chọn đơn vị trực thuộc"
                  >
                    {subUnits
                      .filter(s => s.co_quan_don_vi_id === personnelFilters.coQuanId)
                      .map(sub => (
                        <Select.Option key={sub.id} value={sub.id}>
                          {sub.ten_don_vi}
                        </Select.Option>
                      ))}
                  </Select>
                </div>
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Tìm kiếm theo tên</Text>
                <Input
                  value={personnelFilters.searchName}
                  onChange={e =>
                    setPersonnelFilters({ ...personnelFilters, searchName: e.target.value })
                  }
                  placeholder="Nhập tên quân nhân"
                />
              </div>
            </Space>
            <Table
              rowSelection={{
                selectedRowKeys: createFormData.personnelIds,
                onChange: (selectedRowKeys, selectedRows) => {
                  const newPersonnelIds = selectedRowKeys as string[];
                  const newAwardInfo = newPersonnelIds.map(id => {
                    const existing = createFormData.personnelAwardInfo.find(
                      info => info.personnelId === id
                    );
                    if (existing) return existing;
                    const person =
                      selectedRows.find((r: Personnel) => r.id === id) ||
                      personnel.find(p => p.id === id);
                    return {
                      personnelId: id,
                      rank: person?.cap_bac || '',
                      position: person?.ChucVu?.ten_chuc_vu || '',
                    };
                  });
                  setCreateFormData({
                    ...createFormData,
                    personnelIds: newPersonnelIds,
                    personnelAwardInfo: newAwardInfo,
                  });
                },
              }}
              columns={[
                {
                  title: 'Họ tên',
                  dataIndex: 'ho_ten',
                  key: 'ho_ten',
                  width: 180,
                  render: (text: string, record: Personnel) => (
                    <div>
                      <strong>{text}</strong>
                      {record.cccd && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            CCCD: {record.cccd}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Cấp bậc',
                  dataIndex: 'cap_bac',
                  key: 'cap_bac',
                  width: 120,
                  render: (text: string) => text || '-',
                },
                {
                  title: 'Chức vụ',
                  key: 'chuc_vu',
                  width: 150,
                  render: (_: unknown, record: Personnel) => record.ChucVu?.ten_chuc_vu || '-',
                },
              ]}
              dataSource={filteredPersonnel}
              rowKey="id"
              pagination={{ ...DEFAULT_ANTD_TABLE_PAGINATION }}
              scroll={{ y: 300 }}
              size="small"
            />

            {createFormData.personnelIds.length > 0 && (
              <Card
                size="small"
                title={
                  <span>
                    Cấp bậc / Chức vụ ({createFormData.personnelIds.length} quân nhân)
                    <span className="text-red-500"> *</span>
                  </span>
                }
                style={{ marginTop: 16 }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                  Cấp bậc và chức vụ là bắt buộc, sẽ được lưu vào khen thưởng.
                </Text>
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                  {createFormData.personnelAwardInfo.map((info, index) => {
                    const person = personnel.find(p => p.id === info.personnelId);
                    if (!person) return null;
                    const isMissingRank = !info.rank;
                    const isMissingPosition = !info.position;
                    return (
                      <div
                        key={info.personnelId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '180px 1fr 1fr',
                          gap: 12,
                          padding: '8px 0',
                          borderBottom:
                            index < createFormData.personnelAwardInfo.length - 1
                              ? '1px solid var(--ant-color-border)'
                              : 'none',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <Text strong>{person.ho_ten}</Text>
                        </div>
                        <Select
                          size="large"
                          placeholder="Chọn cấp bậc *"
                          value={info.rank || undefined}
                          onChange={value => {
                            const newInfo = [...createFormData.personnelAwardInfo];
                            newInfo[index] = { ...newInfo[index], rank: value || '' };
                            setCreateFormData({ ...createFormData, personnelAwardInfo: newInfo });
                          }}
                          showSearch
                          optionFilterProp="label"
                          options={RANK_OPTIONS}
                          style={{ width: '100%', height: 40 }}
                          status={isMissingRank ? 'error' : undefined}
                        />
                        <Input
                          size="large"
                          placeholder="Chức vụ"
                          value={info.position}
                          onChange={e => {
                            const newInfo = [...createFormData.personnelAwardInfo];
                            newInfo[index] = { ...newInfo[index], position: e.target.value };
                            setCreateFormData({ ...createFormData, personnelAwardInfo: newInfo });
                          }}
                          status={isMissingPosition ? 'error' : undefined}
                          style={{ height: 40 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                Đã chọn:{' '}
                <strong style={{ color: '#1890ff' }}>{createFormData.unitIds.length}</strong> đơn vị
              </Text>
            </div>
            <Space direction="vertical" size="small" style={{ marginBottom: 16, width: '100%' }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Loại đơn vị</Text>
                <Select
                  style={{ width: '100%' }}
                  value={unitFilters.type}
                  onChange={value => setUnitFilters({ type: value })}
                >
                  <Select.Option value="ALL">Tất cả</Select.Option>
                  <Select.Option value="CO_QUAN">Cơ quan đơn vị</Select.Option>
                  <Select.Option value="DON_VI">Đơn vị trực thuộc</Select.Option>
                </Select>
              </div>
            </Space>
            <Table
              rowSelection={{
                selectedRowKeys: createFormData.unitIds,
                onChange: selectedRowKeys =>
                  setCreateFormData({ ...createFormData, unitIds: selectedRowKeys as string[] }),
              }}
              columns={[
                { title: 'Tên đơn vị', dataIndex: 'ten_don_vi', key: 'ten_don_vi', width: 300 },
                {
                  title: 'Loại',
                  key: 'loai',
                  width: 150,
                  render: (_: unknown, record: Unit) => {
                    const isCoQuan = units.find(u => u.id === record.id);
                    return (
                      <Tag color={isCoQuan ? 'blue' : 'green'}>
                        {isCoQuan ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
                      </Tag>
                    );
                  },
                },
              ]}
              dataSource={filteredUnits}
              rowKey="id"
              pagination={{ ...DEFAULT_ANTD_TABLE_PAGINATION }}
              scroll={{ y: 300 }}
              size="small"
            />
          </div>
        );

      case 2:
        return (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Tải file đính kèm
              </Text>
              <Text type="secondary">Tải lên các file đính kèm (không bắt buộc)</Text>
            </div>
            <Upload
              fileList={createAttachedFileList}
              onChange={({ fileList }) => setCreateAttachedFileList(fileList)}
              beforeUpload={() => false}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />} size="large" style={{ width: '100%' }}>
                Chọn file đính kèm
              </Button>
            </Upload>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Hỗ trợ: PDF, Word, Excel, hình ảnh. Tối đa 10 file.
            </Text>
          </div>
        );

      case 3:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {selectedDecision && (
              <Alert
                message="Đã tải quyết định từ hệ thống"
                description={`Quyết định "${selectedDecision.so_quyet_dinh}" đã tồn tại. Thông tin đã được tự động điền.`}
                type="success"
                showIcon
                closable
                onClose={() => setSelectedDecision(null)}
              />
            )}

            {selectedDecision?.file_path && (
              <Card size="small" title="File quyết định đã lưu trong hệ thống">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--ant-color-fill-quaternary)',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileOutlined style={{ color: '#52c41a' }} />
                    <Text>{selectedDecision.file_path.split('/').pop()}</Text>
                    <Tag color="green">Đã lưu</Tag>
                  </div>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                      const link = document.createElement('a');
                      link.href = `${baseUrl}/${selectedDecision.file_path}`;
                      link.download = selectedDecision.file_path?.split('/').pop() || 'file';
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Tải về
                  </Button>
                </div>
              </Card>
            )}

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Số quyết định</Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                Nhập để tìm kiếm quyết định đã có hoặc tạo mới
              </Text>
              <AutoComplete
                options={decisionOptions}
                onSearch={handleSearchDecision}
                onSelect={value => handleDecisionSelect(value)}
                placeholder="Nhập số quyết định (VD: 123/QĐ-BQP)"
                notFoundContent={searchingDecision ? <Spin size="small" /> : null}
                style={{ width: '100%' }}
              >
                <Input
                  size="large"
                  value={createFormData.decisionNumber}
                  onChange={e =>
                    setCreateFormData({ ...createFormData, decisionNumber: e.target.value })
                  }
                />
              </AutoComplete>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Năm quyết định</Text>
                <Input
                  type="number"
                  value={createFormData.decisionYear}
                  onChange={e =>
                    setCreateFormData({
                      ...createFormData,
                      decisionYear: parseInt(e.target.value) || new Date().getFullYear(),
                    })
                  }
                  size="large"
                  disabled={!!selectedDecision}
                />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Ngày ký quyết định</Text>
                <DatePicker
                  value={createFormData.signDate ? dayjs(createFormData.signDate) : null}
                  onChange={date =>
                    setCreateFormData({
                      ...createFormData,
                      signDate: date ? dayjs(date).format('YYYY-MM-DD') : '',
                    })
                  }
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày ký"
                  size="large"
                  style={{ width: '100%' }}
                  disabled={!!selectedDecision}
                />
              </div>
            </div>

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Người ký quyết định</Text>
              <Input
                value={createFormData.signer}
                onChange={e => setCreateFormData({ ...createFormData, signer: e.target.value })}
                placeholder="VD: Trung tướng Nguyễn Văn A - Chính ủy"
                size="large"
                disabled={!!selectedDecision}
              />
            </div>
          </Space>
        );

      case 4:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Loại">
                  <Tag color={type === 'CA_NHAN' ? 'blue' : 'green'}>
                    {type === 'CA_NHAN' ? 'Cá nhân' : 'Tập thể'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm">{createFormData.year}</Descriptions.Item>
                <Descriptions.Item label="Hình thức khen thưởng" span={2}>
                  {createFormData.awardForm}
                </Descriptions.Item>
                {createFormData.decisionNumber && (
                  <Descriptions.Item label="Số quyết định">
                    {createFormData.decisionNumber}
                  </Descriptions.Item>
                )}
                {createFormData.signer && (
                  <Descriptions.Item label="Người ký">{createFormData.signer}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>Ghi chú</Text>
              <TextArea
                size="large"
                value={createFormData.note}
                onChange={e => setCreateFormData({ ...createFormData, note: e.target.value })}
                placeholder="Ghi chú bổ sung cho khen thưởng (không bắt buộc)"
                rows={2}
              />
            </div>

            {createAttachedFileList.length > 0 && (
              <Card size="small" title={`File đính kèm (${createAttachedFileList.length} file)`}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {createAttachedFileList.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        backgroundColor: 'var(--ant-color-fill-quaternary)',
                        borderRadius: 4,
                      }}
                    >
                      <FileOutlined style={{ color: '#1890ff' }} />
                      <Text>{file.name}</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            )}

            <Card
              size="small"
              title={
                type === 'CA_NHAN'
                  ? `Danh sách cá nhân (${createFormData.personnelIds.length} người)`
                  : `Danh sách đơn vị (${createFormData.unitIds.length} đơn vị)`
              }
            >
              {type === 'CA_NHAN' ? (
                <Table
                  columns={[
                    {
                      title: 'STT',
                      key: 'stt',
                      width: 60,
                      render: (_: unknown, __: unknown, index: number) => index + 1,
                    },
                    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten' },
                    {
                      title: 'Cấp bậc',
                      key: 'cap_bac',
                      render: (_: unknown, record: Personnel) => {
                        const awardInfo = createFormData.personnelAwardInfo.find(
                          info => info.personnelId === record.id
                        );
                        return awardInfo?.rank || record.cap_bac || '-';
                      },
                    },
                    {
                      title: 'Chức vụ',
                      key: 'chuc_vu',
                      render: (_: unknown, record: Personnel) => {
                        const awardInfo = createFormData.personnelAwardInfo.find(
                          info => info.personnelId === record.id
                        );
                        return awardInfo?.position || record.ChucVu?.ten_chuc_vu || '-';
                      },
                    },
                  ]}
                  dataSource={createFormData.personnelIds
                    .map(id => personnel.find(p => p.id === id))
                    .filter((p): p is Personnel => p != null)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Table
                  columns={[
                    {
                      title: 'STT',
                      key: 'stt',
                      width: 60,
                      render: (_: unknown, __: unknown, index: number) => index + 1,
                    },
                    { title: 'Tên đơn vị', dataIndex: 'ten_don_vi', key: 'ten_don_vi' },
                    {
                      title: 'Loại',
                      key: 'loai',
                      render: (_: unknown, record?: Unit) => {
                        const isCoQuan = units.find(u => u.id === record?.id);
                        return (
                          <Tag color={isCoQuan ? 'blue' : 'green'}>
                            {isCoQuan ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
                          </Tag>
                        );
                      },
                    },
                  ]}
                  dataSource={createFormData.unitIds
                    .map(id => units.find(u => u.id === id) || subUnits.find(s => s.id === id))
                    .filter(Boolean)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              )}
            </Card>
          </Space>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title="Thêm khen thưởng đột xuất"
      open={open}
      onCancel={handleClose}
      width={1080}
      footer={null}
      destroyOnClose
      centered
      maskClosable={false}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          paddingRight: 8,
          paddingBottom: 16,
        },
      }}
    >
      <Steps
        current={createFormData.currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Thông tin cơ bản' },
          { title: 'Đối tượng' },
          { title: 'Tải tệp lên' },
          { title: 'Quyết định' },
          { title: 'Xem lại' },
        ]}
      />

      <div style={{ minHeight: 300, paddingBottom: 8 }}>{renderCreateStep()}</div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--ant-color-border)',
        }}
      >
        <Button
          onClick={() =>
            setCreateFormData(prev => ({
              ...prev,
              currentStep: Math.max(prev.currentStep - 1, 0),
            }))
          }
          disabled={createFormData.currentStep === 0}
        >
          Quay lại
        </Button>
        <div>
          {createFormData.currentStep < 4 ? (
            <Button
              type="primary"
              onClick={() => {
                if (validateCreateStep(createFormData.currentStep)) {
                  setCreateFormData(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
                }
              }}
            >
              Tiếp theo
            </Button>
          ) : (
            <Button type="primary" onClick={handleCreateSubmit} loading={submitting}>
              Tạo khen thưởng
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
