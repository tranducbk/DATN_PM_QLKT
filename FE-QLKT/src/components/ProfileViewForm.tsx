'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Alert, message, ConfigProvider, Tag, Breadcrumb } from 'antd';
import {
  UserOutlined,
  IdcardOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
  BankOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { getApiErrorMessage } from '@/lib/apiError';
import { getRoleInfo } from '@/constants/roles.constants';

interface ProfileViewFormProps {
  personnelId?: string; // Optional: nếu không có thì lấy từ token
}

export default function ProfileViewForm({
  personnelId: externalPersonnelId,
}: ProfileViewFormProps = {}) {
  const router = useRouter();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnelData, setPersonnelData] = useState<any>(null);

  useEffect(() => {
    loadPersonnelData();
  }, [externalPersonnelId]);

  const loadPersonnelData = async () => {
    try {
      setLoading(true);

      // Nếu có externalPersonnelId thì dùng nó, không thì lấy từ token
      let targetPersonnelId = externalPersonnelId;

      if (!targetPersonnelId) {
        // Lấy thông tin user từ token
        const token = localStorage.getItem('accessToken');
        if (!token) {
          message.error('Vui lòng đăng nhập lại');
          router.push('/login');
          return;
        }

        // Decode JWT để lấy quan_nhan_id
        const payload = JSON.parse(atob(token.split('.')[1]));
        const { quan_nhan_id } = payload;

        if (!quan_nhan_id) {
          message.error('Không tìm thấy thông tin quân nhân');
          return;
        }

        targetPersonnelId = String(quan_nhan_id);
      }

      // Lấy thông tin personnel
      const response = await apiClient.getPersonnelById(targetPersonnelId);

      if (response.success && response.data) {
        setPersonnelData(response.data);
      }
    } catch (error: unknown) {
      // Error handled by UI
      const errorMessage =
        getApiErrorMessage(error, 'Không thể tải thông tin cá nhân');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="Đang tải thông tin..." />
      </div>
    );
  }

  return (
    <ConfigProvider theme={getAntdThemeConfig(isDark)}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <Breadcrumb.Item>
            <Link href="/user/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href="/user/profile">Lịch sử chi tiết</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Thông tin cá nhân</Breadcrumb.Item>
        </Breadcrumb>

        <Card
          title={
            <div className="flex items-center gap-2">
              <UserOutlined className="text-2xl" />
              <span className="text-2xl font-bold">Thông tin cá nhân</span>
            </div>
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
                      { label: 'ID', value: personnelData.id },
                      { label: 'Họ và tên', value: personnelData.ho_ten || '-' },
                      {
                        label: 'Giới tính',
                        value:
                          personnelData.gioi_tinh === 'NAM'
                            ? 'Nam'
                            : personnelData.gioi_tinh === 'NU'
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
                        value: personnelData.ChucVu?.he_so_chuc_vu
                          ? Number(personnelData.ChucVu.he_so_chuc_vu).toFixed(2)
                          : '-',
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
      </div>
    </ConfigProvider>
  );
}
