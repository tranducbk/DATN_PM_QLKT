'use client';

import { useState, useMemo } from 'react';
import {
  Modal,
  Form,
  message,
  Alert,
  Steps,
  Button,
  Table,
  AutoComplete,
  Input,
  DatePicker,
  Upload,
  Space,
  Typography,
  Tag,
  Divider,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import { CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import dayjs from 'dayjs';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';

const { Text } = Typography;
const { TextArea } = Input;

interface Proposal {
  id: string;
  loai_de_xuat: string;
  nam: number;
  title_data?: any[];
  data_danh_hieu?: any[];
  NguoiDeXuat?: {
    QuanNhan?: {
      ho_ten: string;
    };
    username: string;
  };
}

interface ApproveModalProps {
  visible: boolean;
  proposal: Proposal;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_BY_LOAI: Record<string, { soQuyetDinh: string; pdf: string }> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    soQuyetDinh: 'so_quyet_dinh_ca_nhan_hang_nam',
    pdf: 'file_pdf_ca_nhan_hang_nam',
  },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
    soQuyetDinh: 'so_quyet_dinh_don_vi_hang_nam',
    pdf: 'file_pdf_don_vi_hang_nam',
  },
  [PROPOSAL_TYPES.NIEN_HAN]: { soQuyetDinh: 'so_quyet_dinh_nien_han', pdf: 'file_pdf_nien_han' },
  [PROPOSAL_TYPES.HC_QKQT]: { soQuyetDinh: 'so_quyet_dinh_nien_han', pdf: 'file_pdf_nien_han' },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    soQuyetDinh: 'so_quyet_dinh_nien_han',
    pdf: 'file_pdf_nien_han',
  },
  [PROPOSAL_TYPES.CONG_HIEN]: { soQuyetDinh: 'so_quyet_dinh_cong_hien', pdf: 'file_pdf_cong_hien' },
  [PROPOSAL_TYPES.DOT_XUAT]: { soQuyetDinh: 'so_quyet_dinh_dot_xuat', pdf: 'file_pdf_dot_xuat' },
  [PROPOSAL_TYPES.NCKH]: { soQuyetDinh: 'so_quyet_dinh_nckh', pdf: 'file_pdf_nckh' },
};

interface DecisionFormData {
  so_quyet_dinh: string;
  nam: number;
  ngay_ky: any;
  nguoi_ky: string;
  ghi_chu?: string;
}

export function ApproveModal({ visible, proposal, onClose, onSuccess }: ApproveModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Decision autocomplete
  const [decisionOptions, setDecisionOptions] = useState<any[]>([]);
  const [searchingDecision, setSearchingDecision] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);

  // File upload
  const [fileList, setFileList] = useState<any[]>([]);

  const groupedList = useMemo(() => {
    const titleData = proposal.title_data || proposal.data_danh_hieu || [];
    const grouped = titleData.reduce((acc: any, item: any) => {
      const key = item.danh_hieu || `${item.loai}_${item.mo_ta?.substring(0, 20)}`;
      if (!acc[key]) {
        acc[key] = { danh_hieu: item.danh_hieu || item.loai, count: 0, items: [] };
      }
      acc[key].count++;
      acc[key].items.push(item);
      return acc;
    }, {});
    return Object.values(grouped);
  }, [proposal.title_data, proposal.data_danh_hieu]);

  const handleSearchDecision = async (searchText: string) => {
    if (!searchText || searchText.trim().length === 0) {
      setDecisionOptions([]);
      return;
    }

    try {
      setSearchingDecision(true);
      const response = await apiClient.autocompleteDecisions(
        searchText.trim(),
        10,
        proposal.loai_de_xuat
      );

      if (response.success) {
        const options = response.data.map((d: any) => ({
          value: d.so_quyet_dinh,
          label: `${d.so_quyet_dinh} (${d.nam} - ${d.nguoi_ky})`,
          data: d,
        }));
        setDecisionOptions(options);
      } else {
        setDecisionOptions([]);
      }
    } catch (error) {
      // Error handled by UI
      setDecisionOptions([]);
    } finally {
      setSearchingDecision(false);
    }
  };

  const handleDecisionSelect = (value: string, option: any) => {
    if (option.data) {
      setSelectedDecision(option.data);
      form.setFieldsValue({
        so_quyet_dinh: option.data.so_quyet_dinh,
        nam: option.data.nam,
        ngay_ky: dayjs(option.data.ngay_ky),
        nguoi_ky: option.data.nguoi_ky,
        ghi_chu: option.data.ghi_chu || '',
      });
    }
  };

  // Handle submit — BE yêu cầu multipart: JSON data_* + đúng field so_quyet_dinh_* theo loại
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (!selectedDecision) {
        const decisionFd = new FormData();
        decisionFd.append('so_quyet_dinh', values.so_quyet_dinh);
        decisionFd.append('nam', String(values.nam));
        decisionFd.append('ngay_ky', values.ngay_ky.format('YYYY-MM-DD'));
        decisionFd.append('nguoi_ky', values.nguoi_ky);
        decisionFd.append('loai_khen_thuong', proposal.loai_de_xuat);
        if (values.ghi_chu) {
          decisionFd.append('ghi_chu', String(values.ghi_chu));
        }
        const decisionResponse = await apiClient.createDecision(decisionFd);
        if (!decisionResponse.success) {
          throw new Error(decisionResponse.message || 'Không thể tạo quyết định');
        }
      }

      const detailRes = await apiClient.getProposalById(proposal.id);
      if (!detailRes.success || !detailRes.data) {
        throw new Error(detailRes.message || 'Không tải được chi tiết đề xuất');
      }
      const full = detailRes.data as Record<string, unknown>;

      const fields = FIELD_BY_LOAI[proposal.loai_de_xuat];
      if (!fields) {
        message.error('Loại đề xuất chưa được hỗ trợ phê duyệt qua form này');
        return;
      }

      const formData = new FormData();
      formData.append('data_danh_hieu', JSON.stringify(full.data_danh_hieu ?? []));
      formData.append('data_thanh_tich', JSON.stringify(full.data_thanh_tich ?? []));
      formData.append('data_nien_han', JSON.stringify(full.data_nien_han ?? []));
      formData.append('data_cong_hien', JSON.stringify(full.data_cong_hien ?? []));
      formData.append(fields.soQuyetDinh, values.so_quyet_dinh);
      if (values.ghi_chu) {
        formData.append('ghi_chu', String(values.ghi_chu));
      }

      const rawFile = fileList[0]?.originFileObj;
      if (rawFile instanceof File) {
        formData.append(fields.pdf, rawFile);
      }

      const response = await apiClient.approveProposal(proposal.id, formData);

      if (response.success) {
        message.success('Đã phê duyệt đề xuất thành công!');
        form.resetFields();
        setCurrentStep(0);
        setSelectedDecision(null);
        onSuccess();
      } else {
        throw new Error(response.message || 'Phê duyệt thất bại');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi phê duyệt đề xuất'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setCurrentStep(0);
    setSelectedDecision(null);
    setFileList([]);
    onClose();
  };

  // Step 1: Review data
  const renderStep1 = () => {
    const columns: ColumnsType<any> = [
      {
        title: 'STT',
        key: 'index',
        width: 60,
        align: 'center',
        render: (_, __, index) => index + 1,
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        key: 'danh_hieu',
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: 'Số quân nhân',
        dataIndex: 'count',
        key: 'count',
        width: 120,
        align: 'center',
        render: (count: number) => <Tag color="cyan">{count}</Tag>,
      },
    ];

    return (
      <div>
        <Alert
          message="Bước 1: Xem lại danh sách"
          description="Kiểm tra danh sách danh hiệu và số lượng quân nhân trước khi thêm quyết định"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={groupedList}
          rowKey={record => record.danh_hieu}
          pagination={false}
          size="small"
          bordered
        />
      </div>
    );
  };

  // Step 2: Add decision
  const renderStep2 = () => {
    return (
      <div>
        <Alert
          message="Bước 2: Thêm số quyết định"
          description="Nhập số quyết định. Nếu đã tồn tại trong hệ thống, thông tin sẽ tự động điền."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical" size="large">
          <Form.Item
            label="Số quyết định"
            name="so_quyet_dinh"
            rules={[{ required: true, message: 'Vui lòng nhập số quyết định!' }]}
          >
            <AutoComplete
              options={decisionOptions}
              onSearch={handleSearchDecision}
              onSelect={handleDecisionSelect}
              placeholder="Nhập số quyết định (ví dụ: 123/QD-HVKHQS)"
              size="large"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              label="Năm"
              name="nam"
              rules={[{ required: true, message: 'Vui lòng nhập năm!' }]}
              initialValue={proposal.nam}
            >
              <Input type="number" size="large" placeholder="2024" />
            </Form.Item>

            <Form.Item
              label="Ngày ký"
              name="ngay_ky"
              rules={[{ required: true, message: 'Vui lòng chọn ngày ký!' }]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                size="large"
                style={{ width: '100%' }}
                placeholder="Chọn ngày ký"
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Người ký"
            name="nguoi_ky"
            rules={[{ required: true, message: 'Vui lòng nhập người ký!' }]}
          >
            <Input size="large" placeholder="Ví dụ: Thiếu tướng Nguyễn Văn A - Giám đốc Học viện" />
          </Form.Item>

          <Form.Item label="Ghi chú" name="ghi_chu">
            <TextArea rows={3} placeholder="Ghi chú bổ sung (tùy chọn)" maxLength={500} showCount />
          </Form.Item>

          {selectedDecision && (
            <Alert
              message="Quyết định đã tồn tại trong hệ thống"
              description={`Thông tin quyết định ${selectedDecision.so_quyet_dinh} đã được tự động điền.`}
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Form>
      </div>
    );
  };

  const steps = [
    { title: 'Xem lại', content: renderStep1() },
    { title: 'Quyết định', content: renderStep2() },
  ];

  return (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>Phê duyệt đề xuất khen thưởng</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleCancel}>Hủy</Button>
          <Space>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>Quay lại</Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSubmit}
                loading={loading}
              >
                Xác nhận phê duyệt
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong>Người đề xuất:</Text>{' '}
        {proposal.NguoiDeXuat?.QuanNhan?.ho_ten || proposal.NguoiDeXuat?.username || '-'}
      </div>

      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      <div style={{ minHeight: 300 }}>{steps[currentStep].content}</div>
    </Modal>
  );
}
