'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  Select,
  InputNumber,
  Table,
  Input,
  message,
  Space,
  Typography,
  Breadcrumb,
  Tag,
  Statistic,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DateInput } from '@/lib/types';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';

const { Title, Text } = Typography;
const { Search } = Input;

interface Personnel {
  id: number;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string;
  cap_bac?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
  CoQuanDonVi?: { id: string; ten_don_vi: string };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    CoQuanDonVi?: { id: string; ten_don_vi: string };
  };
  ChucVu?: { id: string; ten_chuc_vu: string };
}

export default function BulkAddAnnualRewardsPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);

  // Set năm hiện tại làm giá trị mặc định
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    form.setFieldsValue({ nam: currentYear });
  }, [form]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterUnitId, setFilterUnitId] = useState<number | undefined>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Filter personnel based on search and unit
    let filtered = [...personnelList];

    if (searchText) {
      filtered = filtered.filter(
        p =>
          p.ho_ten?.toLowerCase().includes(searchText.toLowerCase()) || p.cccd?.includes(searchText)
      );
    }

    if (filterUnitId) {
      filtered = filtered.filter(
        p =>
          String(p.CoQuanDonVi?.id) === String(filterUnitId) ||
          String(p.DonViTrucThuoc?.id) === String(filterUnitId)
      );
    }

    setFilteredPersonnel(filtered);
  }, [searchText, filterUnitId, personnelList, units]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [personnelRes, unitsRes] = await Promise.all([
        apiClient.getPersonnel({ limit: 1000 }),
        apiClient.getUnits(),
      ]);

      if (personnelRes.success) {
        const data = personnelRes.data?.personnel ?? personnelRes.data ?? [];
        setPersonnelList(data);
        setFilteredPersonnel(data);
      }

      if (unitsRes.success) {
        setUnits(unitsRes.data || []);
      }
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Format date helper
  const formatDate = (date: DateInput) => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  };

  const handleCheckAndOpenModal = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất một quân nhân');
      return;
    }

    const values = form.getFieldsValue();

    if (!values.nam || !values.danh_hieu) {
      message.warning('Vui lòng chọn năm và danh hiệu');
      return;
    }

    try {
      setLoading(true);

      // Kiểm tra khen thưởng/đề xuất
      // Lọc bỏ null/undefined (giữ nguyên string IDs vì Prisma dùng String cho ID)

      const validPersonnelIds = selectedRowKeys
        .filter(k => {
          const isValid = k !== null && k !== undefined && k !== '' && typeof k === 'string';
          return isValid;
        })
        .map(k => {
          // Giữ nguyên string ID, không convert sang number
          return k;
        });

      if (validPersonnelIds.length === 0) {
        message.warning('Vui lòng chọn ít nhất một quân nhân hợp lệ');
        return;
      }

      const requestData = {
        personnel_ids: validPersonnelIds as string[],
        nam: Number(values.nam),
        danh_hieu: values.danh_hieu,
      };

      const checkResult = await apiClient.checkAnnualRewards(requestData);

      if (checkResult.success && checkResult.data) {
        // Lọc ra các quân nhân có thể thêm (không có khen thưởng và không có đề xuất)
        const eligible = checkResult.data.results
          .filter((r: any) => !r.has_reward && !r.has_proposal)
          .map((r: any) => r.personnel_id);

        if (eligible.length === 0) {
          message.warning(
            'Tất cả quân nhân đã chọn đều đã có khen thưởng hoặc đề xuất cho năm này'
          );
          return;
        }

        // Gửi tất cả quân nhân đã chọn (không chỉ eligible) để hiển thị đầy đủ
        // Trong page details sẽ chỉ thêm khen thưởng cho những người eligible
        const allSelectedIds = validPersonnelIds;

        // Chuyển sang page nhập thông tin chi tiết
        const params = new URLSearchParams({
          personnel_ids: encodeURIComponent(JSON.stringify(allSelectedIds)),
          eligible_ids: encodeURIComponent(JSON.stringify(eligible)),
          nam: values.nam.toString(),
          danh_hieu: values.danh_hieu,
          check_results: encodeURIComponent(JSON.stringify(checkResult.data)),
        });

        router.push(`/admin/annual-rewards/bulk/details?${params.toString()}`);
      } else {
        message.error(checkResult.message || 'Có lỗi khi kiểm tra khen thưởng');
      }
    } catch (error: unknown) {
      message.error('Có lỗi xảy ra khi kiểm tra khen thưởng');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Personnel> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
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
      render: (_: any, record: Personnel) => {
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
      render: (_: any, record: Personnel) => {
        return record.DonViTrucThuoc?.ten_don_vi || '-';
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 200,
      render: (_: any, record: Personnel) => {
        const capBac = record.cap_bac;
        const chucVu = record.ChucVu?.ten_chuc_vu;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Text strong style={{ marginBottom: '4px' }}>
              {capBac || '-'}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {chucVu || '-'}
            </Text>
          </div>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      // Lọc bỏ null/undefined trước khi set
      const validKeys = newSelectedRowKeys.filter(k => k !== null && k !== undefined && k !== '');
      setSelectedRowKeys(validKeys);
    },
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };

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
          <Link href="/admin/personnel">Quân nhân</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Thêm danh hiệu đồng loạt</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/personnel">
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
          <Title level={2} className="!mb-0">
            Thêm danh hiệu hằng năm đồng loạt
          </Title>
        </div>
      </div>

      {/* Form */}
      <Card title="Thông tin danh hiệu" className="shadow-sm">
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="nam"
              label="Năm"
              rules={[{ required: true, message: 'Vui lòng chọn năm' }]}
            >
              <InputNumber
                placeholder="VD: 2024"
                min={2000}
                max={2100}
                style={{ width: '100%' }}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="danh_hieu"
              label="Danh hiệu"
              rules={[{ required: true, message: 'Vui lòng chọn danh hiệu' }]}
            >
              <Select placeholder="Chọn danh hiệu" size="large">
                <Select.Option value="CSTDCS">
                  <Tag color="blue">CSTDCS</Tag> Chiến sĩ thi đua cơ sở
                </Select.Option>
                <Select.Option value="CSTT">
                  <Tag color="green">CSTT</Tag> Chiến sĩ tiên tiến
                </Select.Option>
                <Select.Option value="BKBQP">
                  <Tag color="purple">BKBQP</Tag> Bằng khen của Bộ trưởng Bộ Quốc phòng
                </Select.Option>
                <Select.Option value="CSTDTQ">
                  <Tag color="orange">CSTDTQ</Tag> Chiến sĩ thi đua Toàn quân
                </Select.Option>
                <Select.Option value="BKTTCP">
                  <Tag color="cyan">BKTTCP</Tag> Bằng khen của Thủ tướng Chính phủ
                </Select.Option>
              </Select>
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
          </div>

          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea
              placeholder="Ghi chú chung cho tất cả quân nhân (ví dụ: chuyển từ đơn vị khác)"
              rows={3}
              size="large"
            />
          </Form.Item>

          <div className="text-gray-500 text-sm mt-2">
            <FilePdfOutlined className="mr-2" />
            File đính kèm sẽ được lưu chung cho tất cả quân nhân được chọn
          </div>
        </Form>
      </Card>

      {/* Statistics */}
      <Card className="shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Statistic
            title="Tổng số quân nhân"
            value={filteredPersonnel.length}
            prefix={<span className="text-blue-500">👥</span>}
          />
          <Statistic
            title="Đã chọn"
            value={selectedRowKeys.length}
            prefix={<span className="text-green-500">✓</span>}
          />
          <Statistic
            title="Chưa chọn"
            value={filteredPersonnel.length - selectedRowKeys.length}
            prefix={<span className="text-gray-400">○</span>}
          />
        </div>
      </Card>

      {/* Personnel Selection */}
      <Card className="shadow-sm">
        <div style={{ marginBottom: '16px' }}>
          <Title level={4} style={{ marginBottom: '16px', marginTop: 0 }}>
            Chọn quân nhân
          </Title>
          <Space wrap style={{ width: '100%' }} size="middle">
            <div style={{ flex: 1, minWidth: 250 }}>
              <Input
                placeholder="Tìm theo tên"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onPressEnter={() => {}}
                size="large"
                allowClear
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ minWidth: 200 }}>
              <Select
                placeholder="Chọn đơn vị"
                style={{ width: '100%' }}
                size="large"
                allowClear
                value={filterUnitId || undefined}
                onChange={value => setFilterUnitId(value || undefined)}
              >
                {units.map(unit => (
                  <Select.Option key={unit.id} value={unit.id}>
                    {unit.ten_don_vi}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Space>
        </div>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredPersonnel}
          rowKey={record => record?.id || `key-${Math.random()}`}
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: total => `Tổng ${total} quân nhân`,
            showSizeChanger: true,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Submit Button */}
      <Card className="shadow-sm">
        <div className="flex justify-end gap-4">
          <Button size="large" onClick={() => form.resetFields()}>
            Đặt lại
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleCheckAndOpenModal}
            loading={loading}
            disabled={selectedRowKeys.length === 0}
          >
            Thêm khen thưởng
          </Button>
        </div>
      </Card>
    </div>
  );
}
