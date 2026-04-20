'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Select, Button, Input, Card, Alert, Skeleton, App } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROLES, roleSelectOptions } from '@/constants/roles.constants';

interface EditFormValues {
  role: string;
}

interface AccountData {
  id: string;
  username: string;
  role: string;
  personnel?: { ho_ten?: string } | null;
}

interface AccountEditFormProps {
  accountId: string;
}

export function AccountEditForm({ accountId }: AccountEditFormProps) {
  const [form] = Form.useForm<EditFormValues>();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const { user } = useAuth();
  const currentUserRole = user?.role || '';

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await apiClient.getAccountById(accountId);
        const accountData = (response.data || response) as AccountData;
        setAccount(accountData);
        form.setFieldsValue({ role: accountData.role });
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Không thể tải thông tin tài khoản'));
        setFetchError(true);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAccount();
  }, [accountId, message, form]);

  const getAvailableRoles = () => {
    if (currentUserRole === ROLES.SUPER_ADMIN) {
      return roleSelectOptions([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]);
    }
    if (currentUserRole === ROLES.ADMIN) {
      return roleSelectOptions([ROLES.MANAGER, ROLES.USER]);
    }
    return roleSelectOptions([ROLES.USER]);
  };

  const onFinish = async (values: EditFormValues) => {
    try {
      setLoading(true);
      const response = await apiClient.updateAccount(
        accountId,
        values as unknown as Record<string, unknown>
      );
      if (response.success) {
        message.success('Cập nhật tài khoản thành công');
        router.push('/accounts');
      } else {
        message.error(response.message || 'Có lỗi xảy ra khi cập nhật tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi cập nhật tài khoản'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setResetPasswordLoading(true);
      const response = await apiClient.resetAccountPassword(accountId);
      if (response.success) {
        message.success('Đặt lại mật khẩu thành công');
      } else {
        message.error(response.message || 'Có lỗi xảy ra khi đặt lại mật khẩu');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi đặt lại mật khẩu'));
    } finally {
      setResetPasswordLoading(false);
    }
  };

  if (loadingData) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (fetchError || !account) {
    return <Alert type="error" message="Không tìm thấy tài khoản" showIcon />;
  }

  return (
    <div className="space-y-6">
      <Card title="Thông tin tài khoản">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Tên đăng nhập">
            <Input value={account.username} disabled />
          </Form.Item>

          <Form.Item label="Họ tên Quân nhân">
            <Input value={account.personnel?.ho_ten || ''} disabled />
          </Form.Item>

          <Form.Item
            label="Vai trò"
            name="role"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              options={getAvailableRoles().map(r => ({ value: r.value, label: r.label }))}
              disabled={loading}
              placeholder="Chọn vai trò"
            />
          </Form.Item>

          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => router.back()} disabled={loading}>
              Quay lại
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {loading ? 'Đang xử lý...' : 'Cập nhật'}
            </Button>
          </div>
        </Form>
      </Card>

      <Card
        title={<span className="text-red-500">Bảo mật</span>}
        styles={{ header: { borderBottom: '1px solid #ff4d4f22' } }}
      >
        <p className="text-sm text-gray-500 mb-4">
          Đặt lại mật khẩu về mặc định: <strong>Hvkhqs@123</strong>
        </p>
        <Button danger onClick={handleResetPassword} loading={resetPasswordLoading}>
          {resetPasswordLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
        </Button>
      </Card>
    </div>
  );
}
