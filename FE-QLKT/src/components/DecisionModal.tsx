'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Upload,
  Button,
  Select,
  App,
  AutoComplete,
  Spin,
  Tag,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';
import { UploadOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/apiClient';
import { LOAI_KHEN_THUONG_OPTIONS } from '@/constants/danhHieu.constants';

interface Decision {
  id?: string;
  so_quyet_dinh: string;
  nam: number;
  ngay_ky: string;
  nguoi_ky: string;
  file_path?: string;
  loai_khen_thuong?: string;
  ghi_chu?: string;
}

interface DecisionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (decision: Decision, isNewDecision?: boolean) => void;
  loaiKhenThuong?: string;
  initialDecision?: {
    id?: string;
    so_quyet_dinh: string;
    nam: number;
    ngay_ky: dayjs.Dayjs;
    nguoi_ky: string;
    file_path?: string | null;
    loai_khen_thuong?: string;
    ghi_chu?: string;
  };
}

interface AutocompleteDecisionItem {
  so_quyet_dinh: string;
  nguoi_ky: string;
  ngay_ky: string;
}

const isValidationError = (err: unknown): boolean =>
  !!err &&
  typeof err === 'object' &&
  'errorFields' in err &&
  Array.isArray((err as { errorFields?: unknown }).errorFields);


function FileSection({
  fileList,
  selectedFilePath,
  disabled,
  onRemove,
  onChange,
}: {
  fileList: UploadFile[];
  selectedFilePath?: string | null;
  disabled: boolean;
  onRemove: () => void;
  onChange: (fileList: UploadFile[]) => void;
}) {
  if (fileList.length > 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #1890ff',
          background: 'rgba(24, 144, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{fileList[0].name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {fileList[0].size ? `${(fileList[0].size / 1024).toFixed(1)} KB` : 'File PDF'}
          </div>
        </div>
        <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} size="small">
          Xoá
        </Button>
      </div>
    );
  }

  if (selectedFilePath) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #b7eb8f',
          background: 'rgba(82, 196, 26, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <FileTextOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{selectedFilePath.split('/').pop()}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>File PDF đã được tải lên</div>
        </div>
        <Tag color="success">Đã có file</Tag>
      </div>
    );
  }

  return (
    <Upload.Dragger
      fileList={fileList}
      onChange={({ fileList }) => onChange(fileList)}
      beforeUpload={() => false}
      accept=".pdf"
      maxCount={1}
      disabled={disabled}
    >
      <p className="ant-upload-drag-icon">
        <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
      </p>
      <p className="ant-upload-text">Kéo thả file vào đây hoặc click để chọn file</p>
      <p className="ant-upload-hint">Chỉ chấp nhận file PDF</p>
    </Upload.Dragger>
  );
}

export function DecisionModal({
  visible,
  onClose,
  onSuccess,
  loaiKhenThuong,
  initialDecision,
}: DecisionModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [autocompleteOptions, setAutocompleteOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  useEffect(() => {
    if (!visible) return;

    if (initialDecision) {
      form.setFieldsValue({
        so_quyet_dinh: initialDecision.so_quyet_dinh,
        nam: initialDecision.nam,
        ngay_ky: initialDecision.ngay_ky,
        nguoi_ky: initialDecision.nguoi_ky,
        loai_khen_thuong: initialDecision.loai_khen_thuong,
        ghi_chu: initialDecision.ghi_chu,
      });
      if (initialDecision.file_path) {
        setFileList([
          {
            uid: '-1',
            name: initialDecision.file_path.split('/').pop() || 'file.pdf',
            status: 'done',
          },
        ]);
      }
      return;
    }

    form.resetFields();
    setFileList([]);
    setSelectedDecision(null);

    const defaults: Record<string, unknown> = {};
    if (loaiKhenThuong) defaults.loai_khen_thuong = loaiKhenThuong;
    if (Object.keys(defaults).length > 0) form.setFieldsValue(defaults);
  }, [visible, loaiKhenThuong, initialDecision, form]);

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setAutocompleteOptions([]);
      return;
    }
    try {
      setSearching(true);
      const autocompleteResponse = await apiClient.autocompleteDecisions(
        value.trim(),
        10,
        loaiKhenThuong
      );
      if (!autocompleteResponse.success || !autocompleteResponse.data) {
        setAutocompleteOptions([]);
        return;
      }
      setAutocompleteOptions(
        autocompleteResponse.data.map((item: AutocompleteDecisionItem) => ({
          value: item.so_quyet_dinh,
          label: `${item.so_quyet_dinh} - ${item.nguoi_ky} (${dayjs(item.ngay_ky).format('DD/MM/YYYY')})`,
        }))
      );
    } catch {
      setAutocompleteOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (value: string) => {
    try {
      setLoading(true);
      const decisionLookupResponse = await apiClient.getDecisionBySoQuyetDinh(value);
      if (!decisionLookupResponse.success || !decisionLookupResponse.data) return;

      const decision = decisionLookupResponse.data;
      setSelectedDecision(decision);
      setFileList([]);
      form.setFieldsValue({
        so_quyet_dinh: decision.so_quyet_dinh,
        nam: decision.nam,
        ngay_ky: dayjs(decision.ngay_ky),
        nguoi_ky: decision.nguoi_ky,
        loai_khen_thuong: decision.loai_khen_thuong || loaiKhenThuong,
        ghi_chu: decision.ghi_chu,
      });
      message.info('Đã chọn quyết định. Hãy kiểm tra thông tin quyết định khen thưởng.');
    } catch {
      message.error('Lỗi khi tải thông tin quyết định');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedDecision(null);
    form.resetFields();
    if (loaiKhenThuong) form.setFieldsValue({ loai_khen_thuong: loaiKhenThuong });
    setFileList([]);
    setAutocompleteOptions([]);
  };

  const handleSubmit = async (saveChanges = false) => {
    try {
      await form.validateFields();

      const values = form.getFieldsValue();
      setLoading(true);

      const formData = new FormData();
      formData.append('so_quyet_dinh', values.so_quyet_dinh);
      formData.append('nam', values.nam.toString());
      formData.append('ngay_ky', dayjs(values.ngay_ky).format('YYYY-MM-DD'));
      formData.append('nguoi_ky', values.nguoi_ky);
      if (values.loai_khen_thuong) formData.append('loai_khen_thuong', values.loai_khen_thuong);
      if (values.ghi_chu) formData.append('ghi_chu', values.ghi_chu);
      if (fileList.length > 0 && fileList[0].originFileObj) {
        formData.append('file', fileList[0].originFileObj);
      }

      let decisionMutationResponse;
      let isNewDecision = false;

      if (initialDecision) {
        let decisionId = initialDecision.id;
        if (!decisionId) {
          const decisionLookupResponse = await apiClient.getDecisionBySoQuyetDinh(values.so_quyet_dinh);
          if (!decisionLookupResponse.success || !decisionLookupResponse.data) {
            throw new Error('Không tìm thấy quyết định để cập nhật');
          }
          decisionId = decisionLookupResponse.data.id;
        }
        decisionMutationResponse = await apiClient.updateDecision(decisionId!, formData);
        message.success('Đã cập nhật quyết định thành công');
      } else if (saveChanges && selectedDecision) {
        decisionMutationResponse = await apiClient.updateDecision(selectedDecision.id!, formData);
        message.success('Đã cập nhật quyết định thành công');
      } else if (!selectedDecision) {
        decisionMutationResponse = await apiClient.createDecision(formData);
        if (!decisionMutationResponse.success) {
          throw new Error(decisionMutationResponse.message || 'Lỗi khi tạo quyết định');
        }
        isNewDecision = true;
        message.success('Đã thêm quyết định mới thành công');
      } else {
        message.success('Đã chọn quyết định');
      }

      const decisionData: Decision = {
        id: selectedDecision?.id || decisionMutationResponse?.data?.id,
        so_quyet_dinh: values.so_quyet_dinh,
        nam: values.nam,
        ngay_ky: dayjs(values.ngay_ky).format('YYYY-MM-DD'),
        nguoi_ky: values.nguoi_ky,
        loai_khen_thuong: values.loai_khen_thuong,
        ghi_chu: values.ghi_chu,
        file_path: decisionMutationResponse?.data?.file_path || selectedDecision?.file_path,
      };

      onSuccess(decisionData, isNewDecision);
      onClose();
    } catch (error: unknown) {
      if (isValidationError(error)) {
        message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }
      message.error(getApiErrorMessage(error, 'Lỗi khi xử lý quyết định'));
    } finally {
      setLoading(false);
    }
  };

  const getHintText = () => {
    if (selectedDecision)
      return 'Đã chọn quyết định. Click nút X để chọn lại quyết định khác. Để sửa thông tin, vui lòng vào trang "Quản lý Quyết định".';
    if (initialDecision) return 'Chế độ chỉnh sửa. Có thể thay đổi các thông tin quyết định.';
    return 'Nhập để tìm kiếm quyết định đã có hoặc tạo mới';
  };

  const existingFilePath = selectedDecision?.file_path || initialDecision?.file_path;

  return (
    <Modal
      title={initialDecision ? 'Sửa Quyết định Khen thưởng' : 'Thêm Số Quyết định Khen thưởng'}
      open={visible}
      onCancel={onClose}
      width="min(700px, calc(100vw - 32px))"
      centered
      style={{ borderRadius: 8 }}
      styles={{ body: { borderRadius: 8, maxHeight: '80vh', overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: 16 } as React.CSSProperties }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        initialDecision && (
          <Button key="save" type="primary" onClick={() => handleSubmit(true)} loading={loading}>
            Lưu thay đổi
          </Button>
        ),
        selectedDecision && !initialDecision && (
          <Button key="use" type="primary" onClick={() => handleSubmit(false)} loading={loading}>
            Thêm quyết định
          </Button>
        ),
        !selectedDecision && !initialDecision && (
          <Button
            key="create"
            type="primary"
            onClick={() => handleSubmit(true)}
            loading={loading}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Thêm mới và Lưu
          </Button>
        ),
      ]}
    >
      <Form form={form} layout="vertical" size="large">
        <Form.Item
          name="so_quyet_dinh"
          label="Số quyết định"
          rules={[{ required: true, message: 'Vui lòng nhập số quyết định' }]}
          style={{ marginBottom: 0 }}
          extra={
            <div
              style={{ fontSize: '12px', color: '#8c8c8c' }}
            >
              {getHintText()}
            </div>
          }
        >
          <AutoComplete
            options={autocompleteOptions}
            onSearch={handleSearch}
            onSelect={handleSelect}
            onClear={handleClear}
            placeholder="Nhập số quyết định (VD: 123/QĐ-BQP)"
            notFoundContent={searching ? <Spin size="small" /> : null}
            style={{ width: '100%' }}
            allowClear
            disabled={!!selectedDecision || !!initialDecision}
          >
            <Input
              size="large"
              disabled={!!selectedDecision || !!initialDecision}
              style={{ fontSize: '14px', height: '40px' }}
            />
          </AutoComplete>
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item
            name="nam"
            label="Năm"
            rules={[{ required: true, message: 'Vui lòng nhập năm' }]}
            style={{ marginBottom: 0 }}
          >
            <Input type="number" placeholder="2024" size="large" disabled={!!selectedDecision} />
          </Form.Item>
          <Form.Item
            name="ngay_ky"
            label="Ngày ký quyết định"
            rules={[{ required: true, message: 'Vui lòng chọn ngày ký' }]}
            style={{ marginBottom: 0 }}
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder="Chọn ngày ký"
              size="large"
              disabled={!!selectedDecision}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="nguoi_ky"
          label="Người ký quyết định"
          rules={[{ required: true, message: 'Vui lòng nhập người ký' }]}
          style={{ marginBottom: 0 }}
        >
          <Input
            placeholder="VD: Trung tướng Nguyễn Văn A - Chính ủy"
            size="large"
            disabled={!!selectedDecision}
          />
        </Form.Item>

        <Form.Item name="loai_khen_thuong" label="Loại khen thưởng" style={{ marginBottom: 12 }}>
          <Select
            placeholder="Chọn loại khen thưởng"
            options={LOAI_KHEN_THUONG_OPTIONS}
            popupMatchSelectWidth={false}
            styles={{ popup: { root: { minWidth: 'max-content' } } }}
            size="large"
            disabled={!!selectedDecision}
          />
        </Form.Item>

        <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginBottom: 0 }}>
          <Input.TextArea
            rows={2}
            placeholder="Ghi chú bổ sung (không bắt buộc)"
            disabled={!!selectedDecision}
          />
        </Form.Item>

        <Form.Item label="File quyết định" style={{ marginBottom: 0 }}>
          <FileSection
            fileList={fileList}
            selectedFilePath={existingFilePath}
            disabled={!!selectedDecision}
            onRemove={() => setFileList([])}
            onChange={setFileList}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
