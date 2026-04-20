'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Spin,
  Alert,
  message,
  Divider,
  Select,
  Descriptions,
  Tag,
  Space,
  ConfigProvider,
} from 'antd';
import {
  UserOutlined,
  IdcardOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
  BankOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/apiClient';
import { VietnamAddressCascader } from './VietnamAddressCascader';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { useTheme } from '@/components/ThemeProvider';
import { formatDate, capitalizeWords } from '@/lib/utils';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROLES, getRoleInfo } from '@/constants/roles.constants';
import type { PersonnelDetail } from '@/lib/types/personnelList';


const parseAddressToArray = (addressString: string | null): string[] | undefined => {
  if (!addressString) return undefined;

  const parts = addressString.split(',').map(part => part.trim());

  if (parts.length !== 3) return undefined;

  const ward = parts[0];
  const district = parts[1];
  const province = parts[2];

  return [province, district, ward];
};

const formatAddressToString = (addressArray: string[]): string => {
  if (!addressArray || addressArray.length !== 3) return '';

  const [province, district, ward] = addressArray;
  return `${ward}, ${district}, ${province}`;
};

// Examples:
const formatAddressInput = (input: string): string => {
  if (!input || !input.trim()) return input;

  const singleAdminWords = ['tỉnh', 'tp', 'tp.', 'huyện', 'quận', 'xã', 'phường', 'tt', 'tt.'];
  const doubleAdminWords = ['thành phố', 'thị xã', 'thị trấn'];

  const parts = input.split(',').map(part => part.trim());

  const formattedParts = parts.map((part, partIndex) => {
    const words = part.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '';

    const firstWord = words[0].toLowerCase();
    const secondWord = words[1]?.toLowerCase();

    let adminLength = 0;
    let formattedAdmin = '';

    if (secondWord && doubleAdminWords.includes(`${firstWord} ${secondWord}`)) {
      adminLength = 2;
      if (partIndex === 0) {
        const formattedFirst = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        formattedAdmin = `${formattedFirst} ${secondWord}`;
      } else {
        formattedAdmin = `${firstWord} ${secondWord}`;
      }
    }
    else if (singleAdminWords.includes(firstWord)) {
      adminLength = 1;
      if (partIndex === 0) {
        formattedAdmin = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      } else {
        formattedAdmin = firstWord;
      }
    }

    if (adminLength > 0) {
      const placeNameWords = words.slice(adminLength);

      const formattedPlaceName = placeNameWords
        .map(word => {
          if (word.length === 0) return word;
          const firstLetterIndex = word.search(
            /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/i
          );
          if (firstLetterIndex === -1) return word;
          const before = word.substring(0, firstLetterIndex);
          const firstLetter = word[firstLetterIndex];
          const rest = word.substring(firstLetterIndex + 1);
          return before + firstLetter.toUpperCase() + rest.toLowerCase();
        })
        .join(' ');

      return `${formattedAdmin} ${formattedPlaceName}`;
    }

    return words
      .map(word => {
        if (word.length === 0) return word;
        const firstLetterIndex = word.search(
          /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/i
        );
        if (firstLetterIndex === -1) return word;
        const before = word.substring(0, firstLetterIndex);
        const firstLetter = word[firstLetterIndex];
        const rest = word.substring(firstLetterIndex + 1);
        return before + firstLetter.toUpperCase() + rest.toLowerCase();
      })
      .join(' ');
  });

  let result = formattedParts.join(', ');

  if (result.length > 0) {
    const firstLetterIndex = result.search(
      /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/i
    );
    if (firstLetterIndex !== -1) {
      const before = result.substring(0, firstLetterIndex);
      const firstLetter = result[firstLetterIndex];
      const rest = result.substring(firstLetterIndex + 1);
      result = before + firstLetter.toUpperCase() + rest;
    }
  }

  return result;
};

interface ProfileEditFormProps {
  personnelId?: string;
  onSuccess?: () => void;
}

export function ProfileEditForm({
  personnelId: externalPersonnelId,
  onSuccess,
}: ProfileEditFormProps = {}) {
  const [form] = Form.useForm();
  const router = useRouter();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personnelData, setPersonnelData] = useState<PersonnelDetail | null>(null);
  const [showTempCCCDWarning, setShowTempCCCDWarning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddressBlur = (fieldName: string) => {
    const currentValue = form.getFieldValue(fieldName);
    if (currentValue && typeof currentValue === 'string') {
      const formatted = formatAddressInput(currentValue);
      if (formatted !== currentValue) {
        form.setFieldValue(fieldName, formatted);
      }
    }
  };

  useEffect(() => {
    loadPersonnelData();
  }, [externalPersonnelId]);

  const loadPersonnelData = async () => {
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

        if (response.data.cccd?.startsWith('TEMP-')) {
          setShowTempCCCDWarning(true);
        }

        // Set form values
        form.setFieldsValue({
          ho_ten: response.data.ho_ten,
          cccd: response.data.cccd,
          gioi_tinh: response.data.gioi_tinh || undefined,
          cap_bac: response.data.cap_bac || undefined,
          ngay_sinh: response.data.ngay_sinh ? dayjs(response.data.ngay_sinh) : null,
          ngay_nhap_ngu: response.data.ngay_nhap_ngu ? dayjs(response.data.ngay_nhap_ngu) : null,
          ngay_xuat_ngu: response.data.ngay_xuat_ngu ? dayjs(response.data.ngay_xuat_ngu) : null,
          que_quan_2_cap: response.data.que_quan_2_cap,
          que_quan_3_cap: parseAddressToArray(response.data.que_quan_3_cap),
          tru_quan: response.data.tru_quan,
          cho_o_hien_nay: response.data.cho_o_hien_nay,
          ngay_vao_dang: response.data.ngay_vao_dang ? dayjs(response.data.ngay_vao_dang) : null,
          ngay_vao_dang_chinh_thuc: response.data.ngay_vao_dang_chinh_thuc
            ? dayjs(response.data.ngay_vao_dang_chinh_thuc)
            : null,
          so_the_dang_vien: response.data.so_the_dang_vien,
          so_dien_thoai: response.data.so_dien_thoai,
          co_quan_don_vi: response.data.CoQuanDonVi?.ten_don_vi || 'Chưa có thông tin',
          don_vi_truc_thuoc: response.data.DonViTrucThuoc?.ten_don_vi || 'Chưa có thông tin',
          chuc_vu: response.data.ChucVu?.ten_chuc_vu || 'Chưa có thông tin',
          role: getRoleInfo(response.data.TaiKhoan?.role || ROLES.USER).label,
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        getApiErrorMessage(error, 'Không thể tải thông tin cá nhân');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setSaving(true);

      if (!personnelData?.id) {
        message.error('Không tìm thấy ID quân nhân');
        return;
      }

      const payload = {
        ho_ten: values.ho_ten,
        gioi_tinh: values.gioi_tinh,
        cccd: values.cccd,
        cap_bac: values.cap_bac || null,
        ngay_sinh: values.ngay_sinh ? dayjs(values.ngay_sinh).format('YYYY-MM-DD') : null,
        ngay_nhap_ngu: values.ngay_nhap_ngu
          ? dayjs(values.ngay_nhap_ngu).format('YYYY-MM-DD')
          : null,
        ngay_xuat_ngu: values.ngay_xuat_ngu
          ? dayjs(values.ngay_xuat_ngu).format('YYYY-MM-DD')
          : null,
        que_quan_2_cap: values.que_quan_2_cap || null,
        que_quan_3_cap: values.que_quan_3_cap ? formatAddressToString(values.que_quan_3_cap) : null,
        tru_quan: values.tru_quan || null,
        cho_o_hien_nay: values.cho_o_hien_nay || null,
        ngay_vao_dang: values.ngay_vao_dang
          ? dayjs(values.ngay_vao_dang).format('YYYY-MM-DD')
          : null,
        ngay_vao_dang_chinh_thuc: values.ngay_vao_dang_chinh_thuc
          ? dayjs(values.ngay_vao_dang_chinh_thuc).format('YYYY-MM-DD')
          : null,
        so_the_dang_vien: values.so_the_dang_vien || null,
        so_dien_thoai: values.so_dien_thoai || null,
        ...(personnelData.co_quan_don_vi_id && { co_quan_don_vi_id: personnelData.co_quan_don_vi_id }),
        ...(personnelData.don_vi_truc_thuoc_id && { don_vi_truc_thuoc_id: personnelData.don_vi_truc_thuoc_id }),
        ...(personnelData.chuc_vu_id && { chuc_vu_id: personnelData.chuc_vu_id }),
      };

      const response = await apiClient.updatePersonnel(String(personnelData.id), payload);

      if (response.success) {
        message.success('Cập nhật thông tin thành công!');

        if (!values.cccd?.startsWith('TEMP-')) {
          setShowTempCCCDWarning(false);
        }

        // Reload data
        await loadPersonnelData();

        setIsEditing(false);

        if (onSuccess) {
          onSuccess();
        }
      } else {
        message.error(response.message || 'Cập nhật thất bại');
      }
    } catch (error: unknown) {
      const errorMessage =
        getApiErrorMessage(error, 'Đã xảy ra lỗi khi cập nhật');
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="Đang tải thông tin..." />
      </div>
    );
  }

  if (!personnelData) {
    return null;
  }

  if (!isEditing) {
    return (
      <ConfigProvider theme={getAntdThemeConfig(isDark)}>
        <div className="p-6 max-w-7xl mx-auto">
          <Card
            title={
              <div className="flex items-center gap-2">
                <UserOutlined className="text-2xl" />
                <span className="text-2xl font-bold">Thông tin cá nhân</span>
              </div>
            }
            className="shadow-lg"
            extra={
              <Button type="primary" icon={<EditOutlined />} onClick={() => setIsEditing(true)}>
                Chỉnh sửa
              </Button>
            }
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

  return (
    <ConfigProvider theme={getAntdThemeConfig(isDark)}>
      <div className="p-6 max-w-7xl mx-auto">
        <Card
          title={
            <div className="flex items-center gap-2">
              <UserOutlined className="text-2xl" />
              <span className="text-2xl font-bold">Thông tin cá nhân</span>
            </div>
          }
          className="shadow-lg"
        >
          <p className="text-gray-600 mb-6">
            Vui lòng cập nhật đầy đủ thông tin cá nhân, đặc biệt là <strong>CCCD</strong>,{' '}
            <strong>Ngày nhập ngũ</strong> và các thông tin địa chỉ, Đảng để hệ thống tính toán khen
            thưởng chính xác.
          </p>

          {showTempCCCDWarning && (
            <Alert
              message="Cảnh báo: CCCD chưa được cập nhật"
              description="Bạn đang sử dụng CCCD tạm thời. Vui lòng cập nhật CCCD chính thức của bạn ngay."
              type="warning"
              showIcon
              closable
              className="mb-6"
              onClose={() => setShowTempCCCDWarning(false)}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
            {/* Thông tin cơ bản */}
            <Divider orientation="left">
              <span className="text-lg font-semibold flex items-center gap-2">
                <UserOutlined className="text-blue-500" />
                Thông tin cơ bản
              </span>
            </Divider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Form.Item
                label="Họ và tên"
                name="ho_ten"
                rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Nhập họ và tên"
                  size="large"
                  className="rounded-lg"
                  onChange={e => form.setFieldValue('ho_ten', capitalizeWords(e.target.value))}
                />
              </Form.Item>

              <Form.Item
                label="Số CCCD/CMND"
                name="cccd"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (/^[0-9]{9,12}$/.test(value)) {
                        return Promise.resolve();
                      }
                      if (value.startsWith('TEMP-')) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('CCCD phải là số từ 9-12 chữ số!'));
                    },
                  },
                ]}
              >
                <Input
                  prefix={<IdcardOutlined />}
                  placeholder="Nhập số CCCD/CMND"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              <Form.Item
                label="Giới tính"
                name="gioi_tinh"
                rules={[{ required: true, message: 'Vui lòng chọn giới tính' }]}
              >
                <Select placeholder="Chọn giới tính" size="large" className="rounded-lg">
                  <Select.Option value="NAM">Nam</Select.Option>
                  <Select.Option value="NU">Nữ</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Ngày sinh" name="ngay_sinh">
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày sinh"
                  size="large"
                  className="w-full rounded-lg"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item label="Số điện thoại" name="so_dien_thoai">
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="Nhập số điện thoại"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>
            </div>

            {/* Thông tin địa chỉ */}
            <Divider orientation="left">
              <span className="text-lg font-semibold flex items-center gap-2">
                <EnvironmentOutlined className="text-green-500" />
                Thông tin địa chỉ
              </span>
            </Divider>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Form.Item
                label="Quê quán (2 cấp)"
                name="que_quan_2_cap"
                tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng (VD: xã hoà an, tỉnh ninh bình → Xã Hoà An, tỉnh Ninh Bình)"
              >
                <Input.TextArea
                  placeholder="Ví dụ: xã hoà an, tỉnh ninh bình"
                  size="large"
                  className="rounded-lg"
                  rows={1}
                  onBlur={() => handleAddressBlur('que_quan_2_cap')}
                />
              </Form.Item>

              <Form.Item label="Quê quán (3 cấp)" name="que_quan_3_cap">
                <VietnamAddressCascader
                  placeholder="Chọn Tỉnh/Thành phố, Quận/Huyện, Xã/Phường"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              <Form.Item
                label="Trú quán"
                name="tru_quan"
                tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng"
              >
                <Input.TextArea
                  placeholder="Ví dụ: phường lào cai, tỉnh lào cai"
                  size="large"
                  className="rounded-lg"
                  rows={1}
                  onBlur={() => handleAddressBlur('tru_quan')}
                />
              </Form.Item>

              <Form.Item
                label="Chỗ ở hiện nay"
                name="cho_o_hien_nay"
                tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng"
              >
                <Input.TextArea
                  placeholder="Ví dụ: xã an hoà, huyện yên bình, tỉnh nam định"
                  size="large"
                  className="rounded-lg"
                  rows={1}
                  onBlur={() => handleAddressBlur('cho_o_hien_nay')}
                />
              </Form.Item>
            </div>

            {/* Thông tin công tác */}
            <Divider orientation="left">
              <span className="text-lg font-semibold flex items-center gap-2">
                <BankOutlined className="text-purple-500" />
                Thông tin công tác
              </span>
            </Divider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Form.Item
                label="Ngày nhập ngũ"
                name="ngay_nhap_ngu"
                rules={[{ required: true, message: 'Vui lòng chọn ngày nhập ngũ!' }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày nhập ngũ"
                  size="large"
                  className="w-full rounded-lg"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item label="Ngày xuất ngũ" name="ngay_xuat_ngu">
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày xuất ngũ (nếu có)"
                  size="large"
                  className="w-full rounded-lg"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item
                label="Quyền hạn"
                name="role"
                extra={
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <InfoCircleOutlined className="text-amber-500" />
                    Chỉ quản trị viên mới có thể thay đổi quyền
                  </span>
                }
              >
                <Input disabled size="large" className="rounded-lg bg-gray-50" />
              </Form.Item>

              <Form.Item
                label="Cơ quan đơn vị"
                name="co_quan_don_vi"
                extra={
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <InfoCircleOutlined className="text-amber-500" />
                    Chỉ quản trị viên mới có thể thay đổi cơ quan đơn vị
                  </span>
                }
              >
                <Input disabled size="large" className="rounded-lg bg-gray-50" />
              </Form.Item>

              <Form.Item
                label="Đơn vị trực thuộc"
                name="don_vi_truc_thuoc"
                extra={
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <InfoCircleOutlined className="text-amber-500" />
                    Chỉ quản trị viên mới có thể thay đổi đơn vị trực thuộc
                  </span>
                }
              >
                <Input disabled size="large" className="rounded-lg bg-gray-50" />
              </Form.Item>

              <Form.Item label="Cấp bậc" name="cap_bac" required={false}>
                <Select placeholder="Chọn cấp bậc" size="large" className="rounded-lg" allowClear>
                  {MILITARY_RANKS.map(rank => (
                    <Select.Option key={rank} value={rank}>
                      {rank}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Chức vụ"
                name="chuc_vu"
                extra={
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <InfoCircleOutlined className="text-amber-500" />
                    Chỉ quản trị viên mới có thể thay đổi chức vụ
                  </span>
                }
              >
                <Input disabled size="large" className="rounded-lg bg-gray-50" />
              </Form.Item>
            </div>

            {/* Thông tin Đảng */}
            <Divider orientation="left">
              <span className="text-lg font-semibold flex items-center gap-2">
                <TeamOutlined className="text-red-500" />
                Thông tin Đảng
              </span>
            </Divider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Form.Item label="Ngày vào Đảng" name="ngay_vao_dang">
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày vào Đảng"
                  size="large"
                  className="w-full rounded-lg"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item label="Ngày vào Đảng chính thức" name="ngay_vao_dang_chinh_thuc">
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày vào Đảng chính thức"
                  size="large"
                  className="w-full rounded-lg"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item label="Số thẻ Đảng viên" name="so_the_dang_vien">
                <Input
                  prefix={<IdcardOutlined />}
                  placeholder="Nhập số thẻ Đảng viên"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>
            </div>

            {/* Submit Button */}
            <Form.Item className="mb-0 mt-6">
              <div className="flex justify-end items-center">
                <Button
                  onClick={() => setIsEditing(false)}
                  size="large"
                  className="min-w-[200px] rounded-lg h-12"
                >
                  Hủy chỉnh sửa
                </Button>

                <div className="ml-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={saving}
                    className="min-w-[200px] rounded-lg h-12 text-lg font-semibold"
                  >
                    Cập nhật thông tin
                  </Button>
                </div>
              </div>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </ConfigProvider>
  );
}
