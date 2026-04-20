'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  Button,
  Form,
  Input,
  Table,
  message,
  Typography,
  Breadcrumb,
  Upload,
  Space,
  Alert,
  Select,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  SaveOutlined,
  UploadOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { DANH_HIEU_MAP } from '@/utils/awardsHelper';
import { DecisionModal } from '@/components/DecisionModal';
import { formatDate } from '@/lib/utils';

const { Title, Text } = Typography;

interface CheckResultsSummary {
  total: number;
  can_add: number;
  has_reward: number;
  has_proposal: number;
}

interface PersonnelRewardData {
  personnel_id: string;
  ho_ten?: string;
  ngay_sinh?: string;
  cccd?: string;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  cap_bac_edit?: string; // Rank at the time of nomination (editable)
  chuc_vu_edit?: string; // Position at the time of nomination (editable)
  isEligible?: boolean; // Whether a reward can be added
  has_reward?: boolean; // Already has a reward
  has_proposal?: boolean; // Has a pending proposal
  CoQuanDonVi?: { id: string; ten_don_vi: string };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    CoQuanDonVi?: { id: string; ten_don_vi: string };
  };
}

export default function BulkRewardDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [personnelData, setPersonnelData] = useState<PersonnelRewardData[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [checkResults, setCheckResults] = useState<{ summary: CheckResultsSummary } | null>(null);
  const [positions, setPositions] = useState<any[]>([]);

  const [eligiblePersonnelIds, setEligiblePersonnelIds] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);

  useEffect(() => {
    const personnelIdsParam = searchParams?.get('personnel_ids');
    const eligibleIdsParam = searchParams?.get('eligible_ids');
    const namParam = searchParams?.get('nam');
    const danhHieuParam = searchParams?.get('danh_hieu');
    const checkResultsParam = searchParams?.get('check_results');

    if (!personnelIdsParam || !namParam || !danhHieuParam) {
      message.error('Thiếu thông tin cần thiết');
      router.push('/admin/annual-rewards/bulk');
      return;
    }

    try {
      const personnelIds = JSON.parse(decodeURIComponent(personnelIdsParam));
      const eligibleIds = eligibleIdsParam
        ? JSON.parse(decodeURIComponent(eligibleIdsParam))
        : personnelIds; // Fallback: if no eligible_ids, treat all as eligible

      const nam = parseInt(namParam);
      const danhHieu = danhHieuParam;

      let checkResultsData = null;
      if (checkResultsParam) {
        checkResultsData = JSON.parse(decodeURIComponent(checkResultsParam));
        setCheckResults(checkResultsData);
      }

      // Keep eligible list for submit step
      setEligiblePersonnelIds(eligibleIds);

      // Init data for ALL selected personnel, not just eligible ones
      const initialData: PersonnelRewardData[] = personnelIds.map((id: string) => {
        const result = checkResultsData?.results?.find((r: any) => r.personnel_id === id);
        const isEligible = eligibleIds.includes(id);
        return {
          personnel_id: id,
          ho_ten: '',
          ngay_sinh: '',
          cap_bac: '',
          chuc_vu: '',
          cap_bac_edit: '',
          chuc_vu_edit: '',
          isEligible,
          has_reward: result?.has_reward || false,
          has_proposal: result?.has_proposal || false,
        };
      });

      setPersonnelData(initialData);
      form.setFieldsValue({ nam, danh_hieu: danhHieu });

      loadInitialData(personnelIds);
    } catch (error) {
      message.error('Dữ liệu không hợp lệ');
      router.push('/admin/annual-rewards/bulk');
    }
  }, [searchParams, router, form]);

  /** Chức vụ + từng quân nhân — một Promise.all (song song hoàn toàn). */
  const loadInitialData = async (personnelIds: string[]) => {
    try {
      setLoading(true);
      const results = await Promise.all([
        apiClient.getPositions(),
        ...personnelIds.map(id => apiClient.getPersonnelById(id)),
      ]);

      const positionsRes = results[0];
      const personnelResponses = results.slice(1);

      if (positionsRes.success) {
        setPositions(positionsRes.data || []);
      }

      const personnelInfo = personnelIds
        .map((id, i) => {
          const res = personnelResponses[i];
          if (res.success && res.data) {
            const d = res.data;
            return {
              personnel_id: id,
              ho_ten: d.ho_ten,
              ngay_sinh: d.ngay_sinh,
              cccd: d.cccd,
              cap_bac: d.cap_bac || '',
              chuc_vu: d.ChucVu?.ten_chuc_vu || '',
              cap_bac_edit: d.cap_bac || '',
              chuc_vu_edit: d.ChucVu?.ten_chuc_vu || '',
              CoQuanDonVi: d.CoQuanDonVi,
              DonViTrucThuoc: d.DonViTrucThuoc,
            };
          }
          return null;
        })
        .filter(Boolean) as {
        personnel_id: string;
        ho_ten?: string;
        ngay_sinh?: string;
        cccd?: string;
        cap_bac?: string;
        chuc_vu?: string;
        cap_bac_edit?: string;
        chuc_vu_edit?: string;
        CoQuanDonVi?: PersonnelRewardData['CoQuanDonVi'];
        DonViTrucThuoc?: PersonnelRewardData['DonViTrucThuoc'];
      }[];

      setPersonnelData(prev =>
        prev.map(item => {
          const info = personnelInfo.find(p => p.personnel_id === item.personnel_id);
          if (info) {
            form.setFieldsValue({
              [`personnel_${item.personnel_id}_cap_bac`]: info.cap_bac_edit,
              [`personnel_${item.personnel_id}_chuc_vu`]: info.chuc_vu_edit,
            });
            return { ...item, ...info };
          }
          return item;
        })
      );
    } catch {
      message.error('Không thể tải thông tin quân nhân');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const formValues = form.getFieldsValue();
      const file = fileList.length > 0 ? (fileList[0].originFileObj as File) : undefined;

      // Submit only eligible personnel
      const eligiblePersonnel = personnelData.filter(p => p.isEligible);

      if (eligiblePersonnel.length === 0) {
        message.warning('Không có quân nhân nào có thể thêm khen thưởng');
        return;
      }

      // Only include personnel with a decision number (set in the modal)
      const personnelWithDecision = eligiblePersonnel.filter(
        p => p.so_quyet_dinh && p.so_quyet_dinh.trim() !== ''
      );

      if (personnelWithDecision.length === 0) {
        message.warning('Vui lòng thêm số quyết định cho ít nhất một quân nhân');
        return;
      }

      const personnelRewardsData = personnelWithDecision.map(p => ({
        personnel_id: p.personnel_id,
        so_quyet_dinh: p.so_quyet_dinh || '',
        cap_bac: p.cap_bac_edit || '',
        chuc_vu: p.chuc_vu_edit || '',
      }));

      const personnelIds = personnelWithDecision.map(p => p.personnel_id);

      const result = await apiClient.bulkCreateAnnualRewards({
        personnel_ids: personnelIds,
        personnel_rewards_data: personnelRewardsData,
        nam: formValues.nam,
        danh_hieu: formValues.danh_hieu,
        ghi_chu: formValues.ghi_chu,
        file_dinh_kem: file,
      });

      if (!result.success) {
        message.error(result.message || 'Có lỗi xảy ra');
        return;
      }
      message.success(result.message || 'Thêm danh hiệu thành công');
      router.push('/admin/annual-rewards/bulk');
    } catch (error: unknown) {
      message.error('Có lỗi xảy ra khi thêm danh hiệu');
    } finally {
      setLoading(false);
    }
  };

  const updatePersonnelData = (
    personnelId: string,
    field: keyof PersonnelRewardData,
    value: any
  ) => {
    setPersonnelData(prev =>
      prev.map(item => (item.personnel_id === personnelId ? { ...item, [field]: value } : item))
    );
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: PersonnelRewardData) => ({
      disabled: !record.isEligible, // Ineligible personnel cannot be selected
    }),
  };

  const handleDecisionSuccess = (decision: any) => {
    if (selectedRowKeys.length === 0 && !editingPersonnelId) {
      message.warning('Vui lòng chọn ít nhất một quân nhân');
      return;
    }

    const soQuyetDinh = decision.so_quyet_dinh;
    const personnelIdsToUpdate = editingPersonnelId
      ? [editingPersonnelId]
      : (selectedRowKeys as string[]);

    setPersonnelData(prev =>
      prev.map(item => {
        if (personnelIdsToUpdate.includes(item.personnel_id)) {
          return { ...item, so_quyet_dinh: soQuyetDinh };
        }
        return item;
      })
    );

    // Auto-select personnel that now have a decision number
    setSelectedRowKeys(prev => {
      const combined = [...prev, ...personnelIdsToUpdate];
      const uniqueKeys = Array.from(new Set(combined));
      return uniqueKeys;
    });

    message.success(
      `Đã áp dụng số quyết định "${soQuyetDinh}" cho ${personnelIdsToUpdate.length} quân nhân`
    );
    setDecisionModalVisible(false);
    setEditingPersonnelId(null);
  };

  const columns: ColumnsType<PersonnelRewardData> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_: unknown, __: any, index: number) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
      render: (text: string, record: PersonnelRewardData) => (
        <div>
          <Text strong={record.isEligible}>{text || '-'}</Text>
          {!record.isEligible && (
            <div style={{ marginTop: 4 }}>
              {record.has_reward && <Tag color="orange">Đã có khen thưởng</Tag>}
              {record.has_proposal && <Tag color="blue">Đang có đề xuất</Tag>}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'ngay_sinh',
      key: 'ngay_sinh',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Cơ quan đơn vị',
      key: 'co_quan_don_vi',
      width: 200,
      render: (_: unknown, record: PersonnelRewardData) => {
        if (record.DonViTrucThuoc?.CoQuanDonVi) {
          return record.DonViTrucThuoc.CoQuanDonVi.ten_don_vi;
        }
        return record.CoQuanDonVi?.ten_don_vi || '-';
      },
    },
    {
      title: 'Đơn vị trực thuộc',
      key: 'don_vi_truc_thuoc',
      width: 200,
      render: (_: unknown, record: PersonnelRewardData) => {
        return record.DonViTrucThuoc?.ten_don_vi || '-';
      },
    },
    {
      title: (
        <span>
          Cấp bậc <span className="text-red-500">(tại thời điểm đề nghị)</span>
        </span>
      ),
      key: 'cap_bac_edit',
      width: 200,
      render: (_: unknown, record: PersonnelRewardData) => (
        <Select
          value={record.cap_bac_edit}
          onChange={value => {
            updatePersonnelData(record.personnel_id, 'cap_bac_edit', value);
            form.setFieldsValue({ [`personnel_${record.personnel_id}_cap_bac`]: value });
          }}
          placeholder="Chọn cấp bậc"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          allowClear
          options={MILITARY_RANKS.map(rank => ({ label: rank, value: rank }))}
        />
      ),
    },
    {
      title: (
        <span>
          Chức vụ <span className="text-red-500">(tại thời điểm đề nghị)</span>
        </span>
      ),
      key: 'chuc_vu_edit',
      width: 250,
      render: (_: unknown, record: PersonnelRewardData) => {
        return (
          <Input
            value={record.chuc_vu_edit || ''}
            onChange={e => {
              const value = e.target.value;
              updatePersonnelData(record.personnel_id, 'chuc_vu_edit', value);
              form.setFieldsValue({ [`personnel_${record.personnel_id}_chuc_vu`]: value });
            }}
            onClear={() => {
              updatePersonnelData(record.personnel_id, 'chuc_vu_edit', '');
              form.setFieldsValue({ [`personnel_${record.personnel_id}_chuc_vu`]: '' });
            }}
            placeholder="Nhập chức vụ"
            style={{ width: '100%' }}
            allowClear
          />
        );
      },
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 200,
      align: 'center' as const,
      render: (_: unknown, record: PersonnelRewardData) => {
        const soQuyetDinh = record.so_quyet_dinh;

        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span
                onClick={() => {
                  if (!record.isEligible) {
                    message.warning('Quân nhân này không thể thêm khen thưởng');
                    return;
                  }
                  setEditingPersonnelId(record.personnel_id);
                  setSelectedRowKeys([record.personnel_id]);
                  setDecisionModalVisible(true);
                }}
                style={{
                  fontWeight: 400,
                  fontStyle: 'italic',
                  opacity: record.isEligible ? 0.6 : 0.4,
                  cursor: record.isEligible ? 'pointer' : 'not-allowed',
                  textDecoration: record.isEligible ? 'underline' : 'none',
                }}
              >
                Chưa có số quyết định
              </span>
            </div>
          );
        }

        return (
          <div style={{ textAlign: 'center' }}>
            <a
              onClick={async e => {
                e.preventDefault();
                e.stopPropagation();

                if (e.ctrlKey || e.metaKey) {
                  // Ctrl/Cmd + Click to download file
                  await downloadDecisionFile(soQuyetDinh);
                } else {
                  // Regular click to change decision number
                  if (!record.isEligible) {
                    message.warning('Quân nhân này không thể thêm khen thưởng');
                    return;
                  }
                  setEditingPersonnelId(record.personnel_id);
                  setSelectedRowKeys([record.personnel_id]);
                  setDecisionModalVisible(true);
                }
              }}
              style={{
                color: '#52c41a',
                fontWeight: 500,
                textDecoration: 'underline',
                cursor: record.isEligible ? 'pointer' : 'not-allowed',
              }}
              title={
                record.isEligible
                  ? 'Click để thay đổi, Ctrl+Click để tải file'
                  : 'Không thể thay đổi'
              }
            >
              {soQuyetDinh}
            </a>
          </div>
        );
      },
    },
  ];

  const formValues = Form.useWatch([], form);
  const nam = formValues?.nam;
  const danhHieu = formValues?.danh_hieu;

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <Breadcrumb.Item>
          <Link href="/admin/dashboard">
            <HomeOutlined />
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link href="/admin/annual-rewards/bulk">Thêm danh hiệu đồng loạt</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Nhập thông tin chi tiết</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/annual-rewards/bulk">
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
          <Title level={2} className="!mb-0">
            Nhập thông tin khen thưởng
          </Title>
        </div>
      </div>

      {checkResults && (
        <Alert
          message="Kết quả kiểm tra"
          description={
            <div>
              <p>Tổng số: {checkResults.summary?.total}</p>
              <p className="text-green-600">
                Có thể thêm: {checkResults.summary?.can_add} quân nhân
              </p>
              {checkResults.summary?.has_reward > 0 && (
                <p className="text-orange-600">
                  Đã có khen thưởng: {checkResults.summary?.has_reward} quân nhân
                </p>
              )}
              {checkResults.summary?.has_proposal > 0 && (
                <p className="text-blue-600">
                  Đang có đề xuất: {checkResults.summary?.has_proposal} quân nhân
                </p>
              )}
            </div>
          }
          type="info"
          showIcon
          className="mb-4"
        />
      )}

      {/* Form */}
      <Card title="Thông tin chung" className="shadow-sm">
        <Form form={form} layout="vertical" size="large">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Form.Item name="nam" label="Năm">
              <Input disabled />
            </Form.Item>
            <Form.Item name="danh_hieu" label="Danh hiệu">
              <Input
                disabled
                value={
                  formValues?.danh_hieu
                    ? DANH_HIEU_MAP[formValues.danh_hieu] || formValues.danh_hieu
                    : ''
                }
              />
            </Form.Item>
          </div>

          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea
              placeholder="Ghi chú chung cho tất cả quân nhân"
              rows={3}
              size="large"
            />
          </Form.Item>

          <Form.Item name="file_dinh_kem" label="File đính kèm" rules={[{ required: false }]}>
            <Upload
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />} size="large">
                Chọn file đính kèm
              </Button>
            </Upload>
          </Form.Item>

          <div className="text-gray-500 text-sm mt-2">
            <FilePdfOutlined className="mr-2" />
            File đính kèm sẽ được lưu chung cho tất cả quân nhân được chọn
          </div>
        </Form>
      </Card>

      {/* Personnel Details Table */}
      <Card
        title="Thông tin từng quân nhân"
        extra={
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => {
              if (selectedRowKeys.length === 0) {
                message.warning('Vui lòng chọn ít nhất một quân nhân');
                return;
              }
              setDecisionModalVisible(true);
            }}
            disabled={selectedRowKeys.length === 0}
          >
            Thêm số quyết định ({selectedRowKeys.length} quân nhân)
          </Button>
        }
        className="shadow-sm"
      >
        <Form form={form} component={false}>
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={personnelData}
            rowKey="personnel_id"
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Form>
      </Card>

      {/* Submit Button */}
      <Card className="shadow-sm">
        <div className="flex justify-end gap-4">
          <Button size="large" onClick={() => router.push('/admin/annual-rewards/bulk')}>
            Hủy
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading}
          >
            Xác nhận thêm khen thưởng
          </Button>
        </div>
      </Card>

      {/* Decision Modal */}
      <DecisionModal
        visible={decisionModalVisible}
        onClose={() => {
          setDecisionModalVisible(false);
          setEditingPersonnelId(null);
        }}
        onSuccess={handleDecisionSuccess}
        loaiKhenThuong="CA_NHAN_HANG_NAM"
      />
    </div>
  );
}
