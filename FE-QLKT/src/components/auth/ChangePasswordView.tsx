'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Breadcrumb,
  message,
  Space,
  Alert,
  ConfigProvider,
  theme as antdTheme,
  Divider,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  LockOutlined,
  SafetyOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

const { Title, Text } = Typography;

export type ChangePasswordViewProps = {
  dashboardHref: string;
};

export function ChangePasswordView({ dashboardHref }: ChangePasswordViewProps) {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const watchedPassword = Form.useWatch('newPassword', form);

  const handleChangePassword = async (values: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setLoading(true);
      const result = await apiClient.changePassword(values.oldPassword, values.newPassword);

      if (!result.success) {
        message.error(result.message || 'Đổi mật khẩu thất bại');
        return;
      }
      message.success('Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập...');
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 1500);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi đổi mật khẩu'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-6 p-6">
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item>
            <Link href={dashboardHref}>
              <DashboardOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Đổi mật khẩu</Breadcrumb.Item>
        </Breadcrumb>

        <div style={{ marginBottom: '32px' }}>
          <Title
            level={2}
            style={{
              margin: 0,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            Đổi mật khẩu
          </Title>
          <Text type="secondary" style={{ fontSize: '15px', display: 'block', marginTop: '8px' }}>
            Cập nhật mật khẩu để bảo vệ tài khoản của bạn một cách an toàn
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '700px' }}>
            <Card
              className="shadow-lg"
              style={{
                marginBottom: '24px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}
            >
              <Alert
                message="Lưu ý bảo mật"
                description="Mật khẩu mới phải có ít nhất 8 ký tự. Khuyến nghị sử dụng mật khẩu mạnh với chữ hoa, chữ thường, số và ký tự đặc biệt."
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                style={{ marginBottom: '24px', borderRadius: '8px' }}
              />

              <Form
                form={form}
                layout="vertical"
                onFinish={handleChangePassword}
                autoComplete="off"
              >
                <Form.Item
                  name="oldPassword"
                  label={
                    <span style={{ fontWeight: 500 }}>
                      <LockOutlined style={{ marginRight: '6px' }} />
                      Mật khẩu hiện tại
                    </span>
                  }
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                    placeholder="Nhập mật khẩu hiện tại"
                    size="large"
                    disabled={loading}
                    style={{ borderRadius: '8px' }}
                  />
                </Form.Item>

                <Form.Item
                  name="newPassword"
                  label={
                    <span style={{ fontWeight: 500 }}>
                      <LockOutlined style={{ marginRight: '6px' }} />
                      Mật khẩu mới
                    </span>
                  }
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                    placeholder="Nhập mật khẩu mới"
                    size="large"
                    disabled={loading}
                    style={{ borderRadius: '8px' }}
                  />
                </Form.Item>
                {watchedPassword && (
                  <div style={{ marginTop: '-16px', marginBottom: '16px' }}>
                    <PasswordStrengthIndicator password={watchedPassword} />
                  </div>
                )}

                <Form.Item
                  name="confirmPassword"
                  label={
                    <span style={{ fontWeight: 500 }}>
                      <LockOutlined style={{ marginRight: '6px' }} />
                      Xác nhận mật khẩu mới
                    </span>
                  }
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                    placeholder="Nhập lại mật khẩu mới"
                    size="large"
                    disabled={loading}
                    style={{ borderRadius: '8px' }}
                  />
                </Form.Item>

                <Divider style={{ margin: '24px 0' }} />

                <Form.Item style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button
                      onClick={() => {
                        form.resetFields();
                      }}
                      disabled={loading}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      size="large"
                      icon={<LockOutlined />}
                      style={{
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                        border: 'none',
                        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)',
                      }}
                    >
                      {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                    </Button>
                  </div>
                </Form.Item>
              </Form>
            </Card>

            <Card
              title={
                <Space>
                  <SafetyOutlined style={{ color: '#9333ea' }} />
                  <span style={{ fontWeight: 600 }}>Bảo mật tài khoản</span>
                </Space>
              }
              className="shadow-lg"
              style={{
                borderRadius: '12px',
                border:
                  theme === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(0, 0, 0, 0.06)',
              }}
            >
              <style>{`
                .change-password-security-tip {
                  display: flex;
                  align-items: flex-start;
                  gap: 12px;
                  padding: 12px;
                  border-radius: 8px;
                  transition: background-color 0.2s;
                }
                .change-password-security-tip:hover {
                  background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
                }
              `}</style>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="change-password-security-tip">
                  <CheckCircleOutlined
                    className="text-green-600 dark:text-green-400 text-lg mt-0.5"
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Sử dụng mật khẩu mạnh
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt để tăng cường bảo mật
                    </Text>
                  </div>
                </div>
                <div className="change-password-security-tip">
                  <CheckCircleOutlined
                    className="text-green-600 dark:text-green-400 text-lg mt-0.5"
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Đổi mật khẩu định kỳ
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Thay đổi mật khẩu thường xuyên (khuyến nghị 3-6 tháng/lần)
                    </Text>
                  </div>
                </div>
                <div className="change-password-security-tip">
                  <CheckCircleOutlined
                    className="text-green-600 dark:text-green-400 text-lg mt-0.5"
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Không chia sẻ mật khẩu
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Giữ bí mật mật khẩu và không chia sẻ cho bất kỳ ai, kể cả nhân viên IT
                    </Text>
                  </div>
                </div>
                <div className="change-password-security-tip">
                  <CheckCircleOutlined
                    className="text-green-600 dark:text-green-400 text-lg mt-0.5"
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Đăng xuất sau khi sử dụng
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Luôn đăng xuất khỏi hệ thống khi sử dụng xong, đặc biệt trên máy tính công
                      cộng
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
