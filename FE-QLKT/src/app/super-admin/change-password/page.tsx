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
} from 'antd';
import {
  LockOutlined,
  SafetyOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

const { Title, Text } = Typography;

export default function SuperAdminChangePasswordPage() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleChangePassword = async (values: any) => {
    try {
      setLoading(true);

      const result = await apiClient.changePassword(values.oldPassword, values.newPassword);

      if (result.success) {
        message.success('Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập...');
        setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, 1500);
      } else {
        message.error(result.message || 'Đổi mật khẩu thất bại');
      }
    } catch (error: any) {
      // Error handled by UI message
      message.error(error.message || 'Có lỗi xảy ra khi đổi mật khẩu');
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
            <Link href="/super-admin/dashboard">
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
            Cập nhật mật khẩu để bảo vệ tài khoản của bạn
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '700px' }}>
            <Card className="shadow-lg" style={{ marginBottom: '24px' }}>
              <Alert
                message="Lưu ý bảo mật"
                description="Mật khẩu mới phải có ít nhất 8 ký tự. Không chia sẻ mật khẩu với người khác."
                type="info"
                showIcon
                style={{ marginBottom: '24px' }}
              />

              <Form
                form={form}
                layout="vertical"
                onFinish={handleChangePassword}
                autoComplete="off"
              >
                <Form.Item
                  name="oldPassword"
                  label="Mật khẩu hiện tại"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Nhập mật khẩu hiện tại"
                    size="large"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item
                  name="newPassword"
                  label="Mật khẩu mới"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Nhập mật khẩu mới"
                    size="large"
                    disabled={loading}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </Form.Item>
                {newPassword && (
                  <div style={{ marginTop: '-16px', marginBottom: '16px' }}>
                    <PasswordStrengthIndicator password={newPassword} />
                  </div>
                )}

                <Form.Item
                  name="confirmPassword"
                  label="Xác nhận mật khẩu mới"
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
                    prefix={<LockOutlined />}
                    placeholder="Nhập lại mật khẩu mới"
                    size="large"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button
                      onClick={() => {
                        form.resetFields();
                        setNewPassword('');
                      }}
                      disabled={loading}
                      size="large"
                    >
                      Hủy
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      size="large"
                      icon={<LockOutlined />}
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
                .security-item-superadmin {
                  display: flex;
                  align-items: flex-start;
                  gap: 12px;
                  padding: 12px;
                  border-radius: 8px;
                  transition: background-color 0.2s;
                }
                .security-item-superadmin:hover {
                  background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
                }
              `}</style>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="security-item-superadmin">
                  <CheckCircleOutlined
                    style={{ color: '#52c41a', fontSize: '18px', marginTop: '2px' }}
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Sử dụng mật khẩu mạnh
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt
                    </Text>
                  </div>
                </div>
                <div className="security-item-superadmin">
                  <CheckCircleOutlined
                    style={{ color: '#52c41a', fontSize: '18px', marginTop: '2px' }}
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Đổi mật khẩu định kỳ
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Thay đổi mật khẩu thường xuyên để tăng cường bảo mật
                    </Text>
                  </div>
                </div>
                <div className="security-item-superadmin">
                  <CheckCircleOutlined
                    style={{ color: '#52c41a', fontSize: '18px', marginTop: '2px' }}
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Không chia sẻ mật khẩu
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Giữ bí mật mật khẩu và không chia sẻ cho bất kỳ ai
                    </Text>
                  </div>
                </div>
                <div className="security-item-superadmin">
                  <CheckCircleOutlined
                    style={{ color: '#52c41a', fontSize: '18px', marginTop: '2px' }}
                  />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                      Đăng xuất sau khi sử dụng
                    </Text>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      Luôn đăng xuất khỏi hệ thống khi sử dụng xong
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
