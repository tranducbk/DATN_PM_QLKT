'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
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
  AutoComplete,
  Descriptions,
  Card,
} from 'antd';
import dayjs from 'dayjs';
import {
  FileOutlined,
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import type { AdhocAward, EditFormData, DecisionAutocompleteRow } from './types';
import { INITIAL_EDIT_FORM, RANK_OPTIONS } from './types';

const { Text } = Typography;
const { TextArea } = Input;

interface EditAdhocAwardModalProps {
  open: boolean;
  award: AdhocAward | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditAdhocAwardModal({
  open,
  award,
  onClose,
  onSuccess,
}: EditAdhocAwardModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>(INITIAL_EDIT_FORM);
  const [editAttachedFileList, setEditAttachedFileList] = useState<UploadFile[]>([]);
  const [removedAttachedFileIndexes, setRemovedAttachedFileIndexes] = useState<number[]>([]);

  const [decisionOptions, setDecisionOptions] = useState<{ value: string; label: string }[]>([]);
  const [searchingDecision, setSearchingDecision] = useState(false);

  useEffect(() => {
    if (award && open) {
      setEditFormData({
        awardForm: award.hinh_thuc_khen_thuong,
        year: award.nam,
        rank: award.cap_bac || '',
        position: award.chuc_vu || '',
        note: award.ghi_chu || '',
        decisionNumber: award.so_quyet_dinh || '',
      });

      const existingAttachedFiles: UploadFile[] =
        award.files_dinh_kem?.map((file, index) => ({
          uid: `existing-attached-${index}`,
          name: file.originalName,
          status: 'done' as const,
          url: `/${file.path}`,
        })) || [];

      setEditAttachedFileList(existingAttachedFiles);
      setRemovedAttachedFileIndexes([]);
      setDecisionOptions([]);
    }
  }, [award, open]);

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
            label: `${item.so_quyet_dinh} - ${item.nguoi_ky} (${dayjs(item.ngay_ky).format('DD/MM/YYYY')})`,
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
        setEditFormData(prev => ({
          ...prev,
          decisionNumber: decision.so_quyet_dinh,
        }));
        message.info('Đã tải thông tin quyết định từ hệ thống');
      }
    } catch {
      message.error('Lỗi khi tải thông tin quyết định');
    }
  }, []);

  const handleClose = () => {
    setEditFormData(INITIAL_EDIT_FORM);
    setEditAttachedFileList([]);
    setRemovedAttachedFileIndexes([]);
    onClose();
  };

  const handleRemoveExistingAttachedFile = (fileUid: string) => {
    const match = fileUid.match(/existing-attached-(\d+)/);
    if (match) {
      const index = parseInt(match[1]);
      setRemovedAttachedFileIndexes(prev => [...prev, index]);
    }
    setEditAttachedFileList(prev => prev.filter(f => f.uid !== fileUid));
  };

  const handleEditSubmit = async () => {
    if (!award) return;

    const { awardForm, year, rank, position, note, decisionNumber } = editFormData;

    if (!awardForm || !year) {
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('awardForm', awardForm);
      formData.append('year', year.toString());
      formData.append('rank', rank);
      formData.append('position', position);
      if (note) formData.append('note', note);
      if (decisionNumber) formData.append('decisionNumber', decisionNumber);

      editAttachedFileList.forEach(file => {
        if (file.originFileObj) {
          formData.append('attachedFiles', file.originFileObj);
        }
      });

      if (removedAttachedFileIndexes.length > 0) {
        formData.append('removeAttachedFileIndexes', JSON.stringify(removedAttachedFileIndexes));
      }

      const res = await apiClient.updateAdhocAward(award.id, formData);

      if (!res.success) {
        message.error(res.message || 'Cập nhật thất bại');
        return;
      }
      message.success('Cập nhật khen thưởng đột xuất thành công');
      handleClose();
      onSuccess();
    } catch {
      message.error('Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa khen thưởng đột xuất"
      open={open}
      onCancel={handleClose}
      width={720}
      footer={null}
      destroyOnClose
      centered
      maskClosable={false}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
    >
      {award && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" title="Thông tin đối tượng">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Đối tượng">
                <Tag color={award.doi_tuong === 'CA_NHAN' ? 'blue' : 'green'}>
                  {award.doi_tuong === 'CA_NHAN' ? 'Cá nhân' : 'Tập thể'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Chi tiết">
                {award.doi_tuong === 'CA_NHAN' && award.QuanNhan && <strong>{award.QuanNhan.ho_ten}</strong>}
                {award.doi_tuong !== 'CA_NHAN' && !!award.CoQuanDonVi && award.CoQuanDonVi.ten_don_vi}
                {award.doi_tuong !== 'CA_NHAN' && !award.CoQuanDonVi && award.DonViTrucThuoc && award.DonViTrucThuoc.ten_don_vi}
                {award.doi_tuong !== 'CA_NHAN' && !award.CoQuanDonVi && !award.DonViTrucThuoc && '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Hình thức khen thưởng <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <Input
              value={editFormData.awardForm}
              onChange={e => setEditFormData({ ...editFormData, awardForm: e.target.value })}
              placeholder="Hình thức khen thưởng"
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Năm <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <InputNumber
              style={{ width: '100%' }}
              value={editFormData.year}
              onChange={value =>
                setEditFormData({ ...editFormData, year: value || new Date().getFullYear() })
              }
              min={2000}
              max={2100}
            />
          </div>

          {award.doi_tuong === 'CA_NHAN' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Cấp bậc</Text>
                <Select
                  placeholder="Chọn cấp bậc"
                  value={editFormData.rank || undefined}
                  onChange={value => setEditFormData({ ...editFormData, rank: value || '' })}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={RANK_OPTIONS}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Chức vụ</Text>
                <Input
                  placeholder="Nhập chức vụ"
                  value={editFormData.position}
                  onChange={e => setEditFormData({ ...editFormData, position: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Số quyết định</Text>
            <AutoComplete
              value={editFormData.decisionNumber}
              options={decisionOptions}
              onSearch={handleSearchDecision}
              onSelect={value => handleDecisionSelect(value)}
              onChange={value =>
                setEditFormData({ ...editFormData, decisionNumber: value || '' })
              }
              placeholder="Nhập số quyết định"
              notFoundContent={searchingDecision ? <Spin size="small" /> : null}
              style={{ width: '100%' }}
            >
              <Input />
            </AutoComplete>
          </div>

          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Ghi chú</Text>
            <TextArea
              value={editFormData.note}
              onChange={e => setEditFormData({ ...editFormData, note: e.target.value })}
              placeholder="Ghi chú bổ sung"
              rows={3}
            />
          </div>

          <Card size="small" title="File đính kèm">
            {editAttachedFileList.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {editAttachedFileList.map(file => (
                  <div
                    key={file.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      marginBottom: 8,
                      backgroundColor: 'var(--ant-color-fill-quaternary)',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileOutlined style={{ color: '#1890ff' }} />
                      <Text>{file.name}</Text>
                      {file.uid.startsWith('existing-attached-') && (
                        <Tag color="blue">Đã lưu</Tag>
                      )}
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        if (file.uid.startsWith('existing-attached-')) {
                          handleRemoveExistingAttachedFile(file.uid);
                        } else {
                          setEditAttachedFileList(prev => prev.filter(f => f.uid !== file.uid));
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <Upload
                fileList={editAttachedFileList.filter(
                  f => !f.uid.startsWith('existing-attached-')
                )}
                onChange={({ fileList }) => {
                  const existingFiles = editAttachedFileList.filter(f =>
                    f.uid.startsWith('existing-attached-')
                  );
                  setEditAttachedFileList([...existingFiles, ...fileList]);
                }}
                beforeUpload={() => false}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>Thêm file đính kèm</Button>
              </Upload>
            </div>
          </Card>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              paddingTop: 16,
              marginTop: 16,
              borderTop: '1px solid var(--ant-color-border)',
              position: 'sticky',
              bottom: 0,
              zIndex: 1,
            }}
          >
            <Button onClick={handleClose}>Hủy</Button>
            <Button type="primary" onClick={handleEditSubmit} loading={submitting}>
              Cập nhật
            </Button>
          </div>
        </Space>
      )}
    </Modal>
  );
}
