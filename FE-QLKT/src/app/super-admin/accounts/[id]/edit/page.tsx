'use client';

import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Select,
  Space,
  ConfigProvider,
  theme as antdTheme,
  Breadcrumb,
  Spin,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import { SaveOutlined, ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { ROLES } from '@/constants/roles.constants';

const { Title } = Typography;
const { Option } = Select;

export default function AccountEditPage() {
  const { theme } = useTheme();
  const params = useParams();
  const accountId = params?.id as string;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (accountId) {
      fetchAccountDetail();
    }
  }, [accountId]);

  const fetchAccountDetail = async () => {
    setFetchLoading(true);
    try {
      const response = await apiClient.getAccountById(accountId);
      if (response.success) {
        const account = response.data;
        form.setFieldsValue({
          username: account.username,
          role: account.role,
        });
      } else {
        message.error(response.message || 'Lỗi khi lấy thông tin tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi lấy thông tin tài khoản'));
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const updateData: any = {
        role: values.role,
      };

      // Chỉ gửi password nếu có thay đổi
      if (values.password) {
        updateData.password = values.password;
      }

      const response = await apiClient.updateAccount(accountId, updateData);

      if (response.success) {
        message.success('Cập nhật tài khoản thành công');
        router.push(`/super-admin/accounts/${accountId}`);
      } else {
        message.error(response.message || 'Cập nhật tài khoản thất bại');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi cập nhật tài khoản'));
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-4 p-6">
        <Breadcrumb
          items={[
            { title: <Link href="/super-admin/dashboard"><HomeOutlined /></Link> },
            { title: <Link href="/super-admin/accounts">Tài khoản</Link> },
            { title: <Link href={`/super-admin/accounts/${accountId}`}>Chi tiết</Link> },
            { title: 'Chỉnh sửa' },
          ]}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/super-admin/accounts/${accountId}`}>
              <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
            </Link>
            <Title level={2} className="mb-0">
              Chỉnh sửa tài khoản
            </Title>
          </div>
        </div>

        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
            <Form.Item name="username" label="Tên đăng nhập">
              <Input disabled placeholder="Tên đăng nhập (không thể thay đổi)" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu mới (tùy chọn)"
              help="Để trống nếu không muốn thay đổi mật khẩu"
              rules={[{ min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }]}
            >
              <Input.Password placeholder="Nhập mật khẩu mới" />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              label="Xác nhận mật khẩu mới"
              dependencies={['password']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const password = getFieldValue('password');
                    if (!password || !value || password === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Nhập lại mật khẩu mới" />
            </Form.Item>

            <Form.Item
              name="role"
              label="Vai trò"
              rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
            >
              <Select placeholder="Chọn vai trò">
                <Option value={ROLES.SUPER_ADMIN}>Super Admin</Option>
                <Option value={ROLES.ADMIN}>Admin</Option>
                <Option value={ROLES.MANAGER}>Quản lý</Option>
                <Option value={ROLES.USER}>Người dùng</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <div className="flex justify-end">
                <Space>
                  <Link href={`/super-admin/accounts/${accountId}`}>
                    <Button>Hủy</Button>
                  </Link>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    Lưu thay đổi
                  </Button>
                </Space>
              </div>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </ConfigProvider>
  );
}
