'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, message, ConfigProvider, Tag, Button, Modal, Form, Input, DatePicker, Row, Col } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { apiClient } from '@/lib/http/apiClient';
import { formatDate, formatHeSoChucVu } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { getApiErrorMessage } from '@/lib/http/apiError';
import { getRoleInfo } from '@/constants/roles.constants';
import { GENDER } from '@/constants/gender.constants';
import type { PersonnelDetail } from '@/lib/types/personnelList';
import { VietnamAddressCascader } from '@/components/shared/VietnamAddressCascader';
import { parseAddressToArray, formatAddressToString } from '@/lib/address';


interface ProfileViewFormProps {
  personnelId?: string;
}

interface ProfileFormValues {
  ho_ten?: string;
  ngay_sinh?: Dayjs | null;
  so_dien_thoai?: string;
  que_quan_2_cap?: string;
  que_quan_3_cap?: string[];
  tru_quan?: string;
  cho_o_hien_nay?: string;
}

export function ProfileViewForm({
  personnelId: externalPersonnelId,
}: ProfileViewFormProps = {}) {
  const router = useRouter();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnelData, setPersonnelData] = useState<PersonnelDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadPersonnelData = useCallback(async () => {
    try {
      setLoading(true);

      // Use externalPersonnelId if provided; otherwise decode from JWT token
      let targetPersonnelId = externalPersonnelId;

      if (!targetPersonnelId) {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          message.error('Vui lòng đăng nhập lại');
          router.push('/login');
          return;
        }

        let quan_nhan_id: string | undefined;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          quan_nhan_id = payload.quan_nhan_id;
        } catch {
          message.error('Token không hợp lệ, vui lòng đăng nhập lại');
          router.push('/login');
          return;
        }

        if (!quan_nhan_id) {
          message.error('Không tìm thấy thông tin quân nhân');
          return;
        }

        targetPersonnelId = String(quan_nhan_id);
      }

      const response = await apiClient.getPersonnelById(targetPersonnelId);

      if (response.success && response.data) {
        setPersonnelData(response.data);
      }
    } catch (error: unknown) {
      const errorMessage =
        getApiErrorMessage(error, 'Không thể tải thông tin cá nhân');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [externalPersonnelId, router]);

  useEffect(() => {
    loadPersonnelData();
  }, [loadPersonnelData]);

  useEffect(() => {
    if (editOpen && personnelData) {
      form.setFieldsValue({
        ho_ten: personnelData.ho_ten,
        ngay_sinh: personnelData.ngay_sinh ? dayjs(personnelData.ngay_sinh) : null,
        so_dien_thoai: personnelData.so_dien_thoai,
        que_quan_2_cap: personnelData.que_quan_2_cap,
        que_quan_3_cap: parseAddressToArray(personnelData.que_quan_3_cap),
        tru_quan: personnelData.tru_quan,
        cho_o_hien_nay: personnelData.cho_o_hien_nay,
      });
    }
  }, [editOpen, personnelData, form]);

  const handleSave = async (values: ProfileFormValues) => {
    try {
      setSaving(true);
      const payload = {
        ...values,
        ngay_sinh: values.ngay_sinh ? values.ngay_sinh.format('YYYY-MM-DD') : null,
        que_quan_3_cap: values.que_quan_3_cap ? formatAddressToString(values.que_quan_3_cap) : null,
      };
      const res = await apiClient.updateMyProfile(payload);
      if (res.success) {
        message.success('Cập nhật thông tin thành công');
        setEditOpen(false);
        loadPersonnelData();
      } else {
        message.error(res.message || 'Cập nhật thất bại');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Cập nhật thất bại'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState className="min-h-[400px]" text="Đang tải thông tin..." />;
  }

  if (!personnelData) {
    return null;
  }

  return (
    <ConfigProvider theme={getAntdThemeConfig(isDark)}>
      <div className="p-6 max-w-7xl mx-auto">
        <PageBreadcrumb
          items={[
            { title: 'Lịch sử chi tiết', href: '/user/profile' },
            { title: 'Thông tin cá nhân' },
          ]}
        />

        <Card
          title={
            <div className="flex items-center gap-2">
              <UserOutlined className="text-2xl" />
              <span className="text-2xl font-bold">Thông tin cá nhân</span>
            </div>
          }
          extra={
            !externalPersonnelId && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                Sửa thông tin
              </Button>
            )
          }
          className="shadow-lg"
        >
          <div className="space-y-4">
            {/* Personnel Information Card */}
            <Card title="Thông tin cá nhân" className="shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className={`min-w-full rounded-lg border ${
                    isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <tbody>
                    {[
                      { label: 'Họ và tên', value: personnelData.ho_ten || '-' },
                      {
                        label: 'Giới tính',
                        value:
                          personnelData.gioi_tinh === GENDER.MALE
                            ? 'Nam'
                            : personnelData.gioi_tinh === GENDER.FEMALE
                              ? 'Nữ'
                              : '-',
                      },
                      { label: 'CCCD', value: personnelData.cccd || '-' },
                      { label: 'Số điện thoại', value: personnelData.so_dien_thoai || '-' },
                      { label: 'Ngày sinh', value: formatDate(personnelData.ngay_sinh) },
                      { label: 'Ngày nhập ngũ', value: formatDate(personnelData.ngay_nhap_ngu) },
                      { label: 'Ngày xuất ngũ', value: formatDate(personnelData.ngay_xuat_ngu) },
                    ].map(item => (
                      <tr
                        key={item.label}
                        className={`border-b last:border-b-0 ${
                          isDark ? 'border-gray-800' : 'border-gray-100'
                        }`}
                      >
                        <td
                          className={`px-4 py-3 text-sm font-semibold w-56 whitespace-nowrap ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          {item.label}
                        </td>
                        <td
                          className={`px-4 py-3 text-base break-words ${
                            isDark ? 'text-gray-200' : 'text-gray-800'
                          }`}
                        >
                          {item.value ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Địa chỉ & Thông tin Đảng" className="shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className={`min-w-full rounded-lg border ${
                    isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <tbody>
                    {[
                      { label: 'Quê quán 2 cấp', value: personnelData.que_quan_2_cap || '-' },
                      { label: 'Quê quán 3 cấp', value: personnelData.que_quan_3_cap || '-' },
                      { label: 'Trú quán hiện nay', value: personnelData.tru_quan || '-' },
                      { label: 'Chỗ ở hiện nay', value: personnelData.cho_o_hien_nay || '-' },
                      { label: 'Ngày vào Đảng', value: formatDate(personnelData.ngay_vao_dang) },
                      {
                        label: 'Ngày vào Đảng chính thức',
                        value: formatDate(personnelData.ngay_vao_dang_chinh_thuc),
                      },
                      { label: 'Số thẻ Đảng viên', value: personnelData.so_the_dang_vien || '-' },
                    ].map(item => (
                      <tr
                        key={item.label}
                        className={`border-b last:border-b-0 ${
                          isDark ? 'border-gray-800' : 'border-gray-100'
                        }`}
                      >
                        <td
                          className={`px-4 py-3 text-sm font-semibold w-56 whitespace-nowrap ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          {item.label}
                        </td>
                        <td
                          className={`px-4 py-3 text-base break-words ${
                            isDark ? 'text-gray-200' : 'text-gray-800'
                          }`}
                        >
                          {item.value ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Đơn vị & Chức vụ" className="shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className={`min-w-full rounded-lg border ${
                    isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <tbody>
                    {[
                      {
                        label: 'Cơ quan đơn vị',
                        value:
                          personnelData.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi ||
                          personnelData.CoQuanDonVi?.ten_don_vi ||
                          '-',
                      },
                      {
                        label: 'Đơn vị trực thuộc',
                        value: personnelData.DonViTrucThuoc?.ten_don_vi || '-',
                      },
                      { label: 'Cấp bậc', value: personnelData.cap_bac || '-' },
                      { label: 'Chức vụ', value: personnelData.ChucVu?.ten_chuc_vu || '-' },
                      {
                        label: 'Hệ số chức vụ',
                        value: formatHeSoChucVu(personnelData.ChucVu?.he_so_chuc_vu),
                      },
                    ].map(item => (
                      <tr
                        key={item.label}
                        className={`border-b last:border-b-0 ${
                          isDark ? 'border-gray-800' : 'border-gray-100'
                        }`}
                      >
                        <td
                          className={`px-4 py-3 text-sm font-semibold w-56 whitespace-nowrap ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          {item.label}
                        </td>
                        <td
                          className={`px-4 py-3 text-base break-words ${
                            isDark ? 'text-gray-200' : 'text-gray-800'
                          }`}
                        >
                          {item.value ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {personnelData.TaiKhoan && (
              <Card title="Tài khoản liên kết" className="shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={`min-w-full rounded-lg border ${
                      isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <tbody>
                      {[
                        { label: 'Username', value: personnelData.TaiKhoan.username },
                        {
                          label: 'Vai trò',
                          value: (
                            <Tag color={getRoleInfo(personnelData.TaiKhoan.role).color}>
                              {getRoleInfo(personnelData.TaiKhoan.role).label}
                            </Tag>
                          ),
                        },
                      ].map(item => (
                        <tr
                          key={item.label}
                          className={`border-b last:border-b-0 ${
                            isDark ? 'border-gray-800' : 'border-gray-100'
                          }`}
                        >
                          <td
                            className={`px-4 py-3 text-sm font-semibold w-48 ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            {item.label}
                          </td>
                          <td
                            className={`px-4 py-3 text-base break-words ${
                              isDark ? 'text-gray-200' : 'text-gray-800'
                            }`}
                          >
                            {item.value ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </Card>

        <Modal
          title="Sửa thông tin cá nhân"
          open={editOpen}
          centered
          width={760}
          styles={{ body: { overflowX: 'hidden' } }}
          onCancel={() => setEditOpen(false)}
          onOk={() => form.submit()}
          confirmLoading={saving}
          okText="Lưu"
          cancelText="Huỷ"
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="ho_ten"
                  label="Họ và tên"
                  rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="ngay_sinh" label="Ngày sinh">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="so_dien_thoai" label="Số điện thoại">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="que_quan_2_cap" label="Quê quán 2 cấp">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="tru_quan" label="Trú quán hiện nay">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="cho_o_hien_nay" label="Chỗ ở hiện nay">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="que_quan_3_cap"
                  label="Quê quán 3 cấp"
                  rules={[{ required: true, message: 'Vui lòng chọn ít nhất Tỉnh/Thành phố' }]}
                >
                  <VietnamAddressCascader size="middle" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
