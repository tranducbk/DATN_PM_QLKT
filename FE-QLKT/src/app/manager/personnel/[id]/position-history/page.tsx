'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Breadcrumb,
  Popconfirm,
  message,
  Spin,
  ConfigProvider,
  theme as antdTheme,
  DatePicker,
  Row,
  Col,
  Statistic,
  Empty,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  LeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { calculateDuration, formatDate } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import dayjs from 'dayjs';
import type { PersonnelDetail } from '@/lib/types/personnelList';


const { Title, Paragraph, Text } = Typography;

interface HistoryRecord {
  id: string;
  chuc_vu_id: string;
  chuc_vu_name: string;
  ngay_bat_dau: string;
  ngay_ket_thuc?: string;
}

export default function PositionHistoryPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [histories, setHistories] = useState<HistoryRecord[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<HistoryRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [personnelId]);

  async function loadData() {
    try {
      setLoading(true);
      const [personnelRes, historiesRes, positionsRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getPositionHistory(personnelId),
        apiClient.getPositions(),
      ]);

      if (personnelRes.success) {
        setPersonnel(personnelRes.data);
      }
      if (historiesRes.success) {
        const mappedHistories = (historiesRes.data || []).map((h: any) => {
          const chucVu = h.ChucVu || {};
          let unitInfo = '';

          if (chucVu.DonViTrucThuoc) {
            const donViName = chucVu.DonViTrucThuoc.ten_don_vi || '';
            const coQuanName = chucVu.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi || '';
            if (donViName && coQuanName) {
              unitInfo = `${donViName}, ${coQuanName}`;
            } else if (donViName) {
              unitInfo = donViName;
            } else if (coQuanName) {
              unitInfo = coQuanName;
            }
          } else if (chucVu.CoQuanDonVi) {
            unitInfo = chucVu.CoQuanDonVi.ten_don_vi || '';
          }

          return {
            ...h,
            chuc_vu_name: chucVu.ten_chuc_vu || '-',
            unit_info: unitInfo,
          };
        });
        setHistories(mappedHistories);
      }
      if (positionsRes.success) {
        setPositions(positionsRes.data || []);
      }
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (history?: any) => {
    if (history) {
      setEditingHistory(history);

      form.setFieldsValue({
        chuc_vu_id: history.chuc_vu_id?.toString(),
        ngay_bat_dau: history.ngay_bat_dau ? dayjs(history.ngay_bat_dau) : null,
        ngay_ket_thuc: history.ngay_ket_thuc ? dayjs(history.ngay_ket_thuc) : null,
        he_so_chuc_vu: history.he_so_chuc_vu || 0,
      });
    } else {
      setEditingHistory(null);
      form.resetFields();
    }
    setDialogOpen(true);
  };

  // Current position = open-ended (no end date); only dates are editable
  const isCurrentPosition = !!(editingHistory && !editingHistory.ngay_ket_thuc);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHistory(null);
    form.resetFields();
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      const payload: any = {
        ngay_bat_dau: values.ngay_bat_dau
          ? dayjs(values.ngay_bat_dau).format('YYYY-MM-DD')
          : undefined,
        // null = explicitly cleared; undefined = not changed (omit from payload)
        ngay_ket_thuc:
          values.ngay_ket_thuc === null
            ? null
            : values.ngay_ket_thuc
              ? dayjs(values.ngay_ket_thuc).format('YYYY-MM-DD')
              : undefined,
        he_so_chuc_vu: values.he_so_chuc_vu || undefined,
      };

      // Current position: only dates are editable, not the position itself
      if (!isCurrentPosition) {
        payload.chuc_vu_id = values.chuc_vu_id;
      }

      const historyId = editingHistory?.id;
      const res = historyId
        ? await apiClient.updatePositionHistory(historyId, payload)
        : await apiClient.createPositionHistory(personnelId, payload);

      if (res.success) {
        const positionWarning = res.warning;
        if (positionWarning) {
          Modal.confirm({
            title: 'Cảnh báo',
            content: positionWarning.message,
            okText: 'Đồng ý',
            cancelText: 'Không',
            onOk: async () => {
              try {
                setSubmitting(true);
                const newPayload = {
                  ...payload,
                  ngay_ket_thuc: positionWarning.suggestedEndDate,
                };
                const updateRes = await apiClient.updatePositionHistory(
                  historyId!,
                  newPayload
                );
                if (updateRes.success) {
                  message.success('Cập nhật lịch sử thành công');
                  handleCloseDialog();
                  loadData();
                } else {
                  message.error(updateRes.message || 'Có lỗi xảy ra');
                }
              } catch (error: unknown) {
                message.error(getApiErrorMessage(error) || 'Có lỗi xảy ra');
              } finally {
                setSubmitting(false);
              }
            },
            onCancel: () => {
              message.success(
                editingHistory ? 'Cập nhật lịch sử thành công' : 'Thêm lịch sử thành công'
              );
              handleCloseDialog();
              loadData();
            },
          });
        } else {
          message.success(
            editingHistory ? 'Cập nhật lịch sử thành công' : 'Thêm lịch sử thành công'
          );
          handleCloseDialog();
          loadData();
        }
      } else {
        message.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error) || 'Có lỗi xảy ra';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalTimeByGroup = (group: '0.7' | '0.8' | '0.9-1.0') => {
    let totalMonths = 0;

    histories.forEach((history: any) => {
      const heSo = Number(history.he_so_chuc_vu) || 0;
      let belongsToGroup = false;

      if (group === '0.7') {
        belongsToGroup = heSo >= 0.7 && heSo < 0.8;
      } else if (group === '0.8') {
        belongsToGroup = heSo >= 0.8 && heSo < 0.9;
      } else if (group === '0.9-1.0') {
        belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
      }

      if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
        totalMonths += history.so_thang;
      }
    });

    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (totalMonths === 0) return '0 năm 0 tháng';
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiClient.deletePositionHistory(deleteId);

      if (res.success) {
        message.success('Xóa lịch sử thành công');
        setDeleteModalOpen(false);
        setDeleteId(null);
        loadData();
      } else {
        message.error(res.message || 'Có lỗi xảy ra khi xóa');
      }
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    }
  };

  const columns: TableColumnsType<HistoryRecord> = [
    {
      title: 'Chức vụ',
      dataIndex: 'chuc_vu_name',
      key: 'chuc_vu_name',
      width: 250,
      align: 'center',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.unit_info && (
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
              {record.unit_info}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'ngay_bat_dau',
      key: 'ngay_bat_dau',
      width: 150,
      align: 'center',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'ngay_ket_thuc',
      key: 'ngay_ket_thuc',
      width: 150,
      align: 'center',
      render: (date: string) => (date ? formatDate(date) : 'Hiện tại'),
    },
    {
      title: 'Hệ số chức vụ',
      dataIndex: 'he_so_chuc_vu',
      key: 'he_so_chuc_vu',
      width: 120,
      align: 'center',
      render: (value: number) =>
        value !== null && value !== undefined ? Number(value).toFixed(2) : '-',
    },
    {
      title: 'Thời gian',
      key: 'duration',
      width: 200,
      align: 'center',
      render: (_, record) => calculateDuration(record.ngay_bat_dau, record.ngay_ket_thuc),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenDialog(record)}
            title="Sửa"
          />
          <Popconfirm
            title="Xác nhận xóa"
            description="Bạn có chắc chắn muốn xóa lịch sử này?"
            onConfirm={() => {
              setDeleteId(record.id);
              setDeleteModalOpen(true);
            }}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="Xóa" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item>
            <Link href="/manager/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href="/manager/personnel">Quân nhân</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href={`/manager/personnel/${personnelId}`}>{personnel?.ho_ten}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Lịch sử chức vụ</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Link href={`/manager/personnel/${personnelId}?tab=3`}>
                <Button icon={<LeftOutlined />}>Quay lại</Button>
              </Link>
            </Space>
            <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              Lịch sử chức vụ
            </Title>
            {personnel && (
              <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
                Quân nhân: {personnel.ho_ten}
              </Paragraph>
            )}
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenDialog()}>
            Thêm lịch sử
          </Button>
        </div>

        {/* Statistics */}
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic
                  title="Tổng thời gian (0.7)"
                  value={0}
                  valueRender={() => calculateTotalTimeByGroup('0.7')}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic
                  title="Tổng thời gian (0.8)"
                  value={0}
                  valueRender={() => calculateTotalTimeByGroup('0.8')}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic
                  title="Tổng thời gian (0.9-1.0)"
                  value={0}
                  valueRender={() => calculateTotalTimeByGroup('0.9-1.0')}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Table */}
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Đang tải dữ liệu...</div>
            </div>
          </Card>
        ) : (
          <Card>
            <Table
              columns={columns}
              dataSource={histories}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu lịch sử chức vụ" />,
              }}
            />
          </Card>
        )}

        {/* Form Modal */}
        <Modal
          title={editingHistory ? 'Sửa lịch sử chức vụ' : 'Thêm lịch sử chức vụ mới'}
          open={dialogOpen}
          onCancel={handleCloseDialog}
          footer={null}
          width={600}
          centered
        >
          <Form form={form} onFinish={onSubmit} layout="vertical" style={{ marginTop: 24 }} size="large">
            {isCurrentPosition && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  backgroundColor: theme === 'dark' ? '#4a3c28' : '#fff7e6',
                  border: `1px solid ${theme === 'dark' ? '#d4a574' : '#ffd591'}`,
                  borderRadius: 4,
                }}
              >
                <Text type="warning">
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  Đây là chức vụ hiện tại. Bạn chỉ có thể sửa thời gian (ngày bắt đầu, ngày kết
                  thúc). Để thay đổi chức vụ đảm nhận, vui lòng sử dụng mục &quot;Cập nhật thông tin
                  cá nhân&quot;.
                </Text>
              </div>
            )}
            <Form.Item
              name="chuc_vu_id"
              label="Chức vụ"
              rules={[{ required: !isCurrentPosition, message: 'Vui lòng chọn chức vụ' }]}
            >
              <Select
                placeholder="Chọn chức vụ"
                size="large"
                showSearch
                optionFilterProp="children"
                disabled={isCurrentPosition}
                filterOption={(input, option) => {
                  const label = String(option?.children || '');
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
                onChange={value => {
                  const selectedPosition = positions.find(
                    (pos: any) => pos.id.toString() === value
                  );
                  if (selectedPosition) {
                    form.setFieldsValue({
                      he_so_chuc_vu: selectedPosition.he_so_chuc_vu || 0,
                    });
                  }
                }}
              >
                {positions.map((pos: any) => {
                  let unitName = '';
                  if (pos.CoQuanDonVi) {
                    unitName = pos.CoQuanDonVi.ten_don_vi;
                  } else if (pos.DonViTrucThuoc) {
                    const donViName = pos.DonViTrucThuoc.ten_don_vi;
                    const coQuanName = pos.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi;
                    unitName = coQuanName ? `${donViName} (${coQuanName})` : donViName;
                  }

                  const heSo = pos.he_so_chuc_vu ? ` (HS: ${pos.he_so_chuc_vu})` : '';
                  const displayText = unitName
                    ? `${pos.ten_chuc_vu} - ${unitName}${heSo}`
                    : `${pos.ten_chuc_vu}${heSo}`;

                  return (
                    <Select.Option key={pos.id} value={pos.id.toString()}>
                      {displayText}
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>

            <Form.Item name="he_so_chuc_vu" label="Hệ số chức vụ" hidden>
              <Input type="hidden" />
            </Form.Item>

            <Form.Item
              name="ngay_bat_dau"
              label="Ngày bắt đầu"
              dependencies={['ngay_ket_thuc']}
              rules={[
                { required: true, message: 'Vui lòng chọn ngày bắt đầu' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) {
                      return Promise.resolve();
                    }
                    const ngayKetThuc = getFieldValue('ngay_ket_thuc');
                    if (ngayKetThuc) {
                      const dateBatDau = dayjs(value);
                      const dateKetThuc = dayjs(ngayKetThuc);

                      if (dateBatDau.isAfter(dateKetThuc) || dateBatDau.isSame(dateKetThuc)) {
                        return Promise.reject(new Error('Ngày bắt đầu phải trước ngày kết thúc'));
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} size="large" />
            </Form.Item>

            <Form.Item
              name="ngay_ket_thuc"
              label="Ngày kết thúc (không bắt buộc)"
              dependencies={['ngay_bat_dau']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) {
                      return Promise.resolve();
                    }
                    const ngayBatDau = getFieldValue('ngay_bat_dau');
                    if (ngayBatDau) {
                      const dateBatDau = dayjs(ngayBatDau);
                      const dateKetThuc = dayjs(value);

                      if (dateKetThuc.isBefore(dateBatDau) || dateKetThuc.isSame(dateBatDau)) {
                        return Promise.reject(new Error('Ngày kết thúc phải sau ngày bắt đầu'));
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                size="large"
                allowClear
                placeholder="Chọn ngày kết thúc (có thể để trống)"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={handleCloseDialog} disabled={submitting}>
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingHistory ? 'Cập nhật' : 'Tạo mới'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          title="Xác nhận xóa"
          open={deleteModalOpen}
          onOk={handleDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setDeleteId(null);
          }}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          centered
        >
          <Paragraph>
            Bạn có chắc chắn muốn xóa lịch sử chức vụ này? Hành động này không thể hoàn tác.
          </Paragraph>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
