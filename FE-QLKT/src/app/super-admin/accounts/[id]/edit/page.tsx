'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Spin,
} from 'antd';
import { getApiErrorMessage } from '@/lib/http/apiError';

import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/http/apiClient';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, roleSelectOptions } from '@/constants/roles.constants';
import type { ManagerPositionRow, UnitApiRow } from '@/lib/types/personnelList';

const { Title, Text } = Typography;

interface CoQuanOption {
  id: string;
  ten_don_vi: string;
}

interface DvttOption {
  id: string;
  ten_don_vi: string;
  co_quan_don_vi_id?: string | null;
}

export default function AccountEditPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useParams();
  const accountId = params?.id as string;
  const isOwnAccount = !!user?.id && user.id === accountId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [coQuanList, setCoQuanList] = useState<CoQuanOption[]>([]);
  const [dvttList, setDvttList] = useState<DvttOption[]>([]);
  const [positions, setPositions] = useState<ManagerPositionRow[]>([]);
  // Personnel accounts (with quan_nhan) swap only within {MANAGER, USER}; admin accounts only within
  // {SUPER_ADMIN, ADMIN}. Crossing groups is disallowed.
  const [isSoldierAccount, setIsSoldierAccount] = useState(true);
  const router = useRouter();

  const selectedRole = Form.useWatch('role', form);
  const selectedCoQuan = Form.useWatch('co_quan_don_vi_id', form);
  const selectedDvtt = Form.useWatch('don_vi_truc_thuoc_id', form);

  // Refs guard the dependent-clearing effects so the initial prefill does not wipe itself.
  const prefilledRef = useRef(false);
  const prevRoleRef = useRef<string | undefined>(undefined);
  const prevCoQuanRef = useRef<string | undefined>(undefined);
  const prevDvttRef = useRef<string | undefined>(undefined);

  const loadAll = useCallback(async () => {
    setFetchLoading(true);
    try {
      const [accountRes, unitsRes, positionsRes] = await Promise.all([
        apiClient.getAccountById(accountId),
        apiClient.getUnits({ hierarchy: true }),
        apiClient.getPositions(),
      ]);

      if (unitsRes.success) {
        const unitsData = (unitsRes.data || []) as UnitApiRow[];
        const coQuan: CoQuanOption[] = [];
        const dvtt: DvttOption[] = [];
        unitsData.forEach(unit => {
          coQuan.push({ id: unit.id, ten_don_vi: unit.ten_don_vi });
          (unit.DonViTrucThuoc || []).forEach(dv => {
            dvtt.push({ id: dv.id, ten_don_vi: dv.ten_don_vi, co_quan_don_vi_id: unit.id });
          });
        });
        setCoQuanList(coQuan);
        setDvttList(dvtt);
      }
      const positionsData = (
        positionsRes.success ? positionsRes.data || [] : []
      ) as ManagerPositionRow[];
      setPositions(positionsData);

      if (accountRes.success) {
        const account = accountRes.data;
        const qn = account.QuanNhan as
          | {
              co_quan_don_vi_id?: string | null;
              don_vi_truc_thuoc_id?: string | null;
              chuc_vu_id?: string | null;
              CoQuanDonVi?: { id: string } | null;
              DonViTrucThuoc?: { id: string; CoQuanDonVi?: { id: string } | null } | null;
              ChucVu?: { id: string } | null;
            }
          | null
          | undefined;
        const coQuanId =
          qn?.CoQuanDonVi?.id ?? qn?.DonViTrucThuoc?.CoQuanDonVi?.id ?? qn?.co_quan_don_vi_id ?? undefined;
        const currentChucVuId = qn?.ChucVu?.id ?? qn?.chuc_vu_id ?? undefined;
        const currentPosition = positionsData.find(p => p.id === currentChucVuId);
        // Only prefill the current position when it fits the role (MANAGER ⇒ command position,
        // USER ⇒ regular position); otherwise force a fresh pick so a stale command position never
        // lingers on a USER and vice versa.
        const positionFitsRole =
          account.role === ROLES.MANAGER
            ? !!currentPosition?.is_manager
            : account.role === ROLES.USER
              ? !currentPosition?.is_manager
              : true;
        form.setFieldsValue({
          username: account.username,
          role: account.role,
          co_quan_don_vi_id: coQuanId,
          don_vi_truc_thuoc_id: qn?.DonViTrucThuoc?.id ?? qn?.don_vi_truc_thuoc_id ?? undefined,
          chuc_vu_id: positionFitsRole ? currentChucVuId : undefined,
        });
        setIsSoldierAccount(!!account.quan_nhan_id);
        prefilledRef.current = true;
      } else {
        message.error(accountRes.message || 'Lỗi khi lấy thông tin tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi lấy thông tin tài khoản'));
    } finally {
      setFetchLoading(false);
    }
  }, [accountId, form]);

  useEffect(() => {
    if (accountId) {
      loadAll();
    }
  }, [accountId, loadAll]);

  // Changing role re-scopes the required unit level → clear the unit/position picks for a fresh choice.
  useEffect(() => {
    if (!prefilledRef.current) return;
    const prev = prevRoleRef.current;
    prevRoleRef.current = selectedRole;
    if (prev === undefined || prev === selectedRole) return;
    form.setFieldsValue({
      co_quan_don_vi_id: undefined,
      don_vi_truc_thuoc_id: undefined,
      chuc_vu_id: undefined,
    });
  }, [selectedRole, form]);

  useEffect(() => {
    if (!prefilledRef.current) return;
    const prev = prevCoQuanRef.current;
    prevCoQuanRef.current = selectedCoQuan;
    if (prev === undefined || prev === selectedCoQuan) return;
    form.setFieldsValue({ don_vi_truc_thuoc_id: undefined, chuc_vu_id: undefined });
  }, [selectedCoQuan, form]);

  useEffect(() => {
    if (!prefilledRef.current) return;
    const prev = prevDvttRef.current;
    prevDvttRef.current = selectedDvtt;
    if (prev === undefined || prev === selectedDvtt) return;
    form.setFieldsValue({ chuc_vu_id: undefined });
  }, [selectedDvtt, form]);

  const showUnitSection = selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER;

  const filteredDvtt =
    selectedRole === ROLES.USER && selectedCoQuan
      ? dvttList.filter(d => d.co_quan_don_vi_id === selectedCoQuan)
      : [];

  const filteredPositions = (() => {
    if (selectedRole === ROLES.MANAGER && selectedCoQuan) {
      return positions.filter(p => p.co_quan_don_vi_id === selectedCoQuan && p.is_manager);
    }
    if (selectedRole === ROLES.USER && selectedDvtt) {
      return positions.filter(p => p.don_vi_truc_thuoc_id === selectedDvtt && !p.is_manager);
    }
    return [];
  })();

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const updateData: Record<string, unknown> = { role: values.role };
      if (values.password) {
        updateData.password = values.password;
      }
      if (values.role === ROLES.MANAGER || values.role === ROLES.USER) {
        updateData.co_quan_don_vi_id = values.co_quan_don_vi_id;
        if (values.role === ROLES.USER) {
          updateData.don_vi_truc_thuoc_id = values.don_vi_truc_thuoc_id;
        }
        updateData.chuc_vu_id = values.chuc_vu_id;
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
        <PageBreadcrumb
          items={[
            { title: 'Tài khoản', href: '/super-admin/accounts' },
            { title: 'Chi tiết', href: `/super-admin/accounts/${accountId}` },
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
              help={isOwnAccount ? 'Không thể thay đổi vai trò của chính mình' : undefined}
            >
              <Select
                placeholder="Chọn vai trò"
                disabled={isOwnAccount}
                options={roleSelectOptions(
                  isSoldierAccount ? [ROLES.MANAGER, ROLES.USER] : [ROLES.SUPER_ADMIN, ROLES.ADMIN]
                )}
              />
            </Form.Item>

            {showUnitSection && (
              <div className="border-t pt-4">
                <h3 className="text-base font-semibold mb-4">Thông tin đơn vị và chức vụ</h3>

                <Form.Item
                  label="Cơ quan đơn vị"
                  name="co_quan_don_vi_id"
                  rules={[{ required: true, message: 'Vui lòng chọn cơ quan đơn vị' }]}
                >
                  <Select
                    options={coQuanList.map(u => ({ value: u.id, label: u.ten_don_vi }))}
                    disabled={loading || coQuanList.length === 0}
                    placeholder={
                      coQuanList.length === 0 ? 'Không có cơ quan đơn vị nào' : 'Chọn cơ quan đơn vị'
                    }
                  />
                </Form.Item>

                {selectedRole === ROLES.USER && (
                  <Form.Item
                    label="Đơn vị trực thuộc"
                    name="don_vi_truc_thuoc_id"
                    rules={[{ required: true, message: 'Vui lòng chọn đơn vị trực thuộc' }]}
                    extra={
                      selectedCoQuan && filteredDvtt.length === 0 ? (
                        <Text type="danger" style={{ fontSize: 12 }}>
                          Cơ quan đơn vị này chưa có đơn vị trực thuộc.
                        </Text>
                      ) : undefined
                    }
                  >
                    <Select
                      options={filteredDvtt.map(u => ({ value: u.id, label: u.ten_don_vi }))}
                      disabled={loading || !selectedCoQuan || filteredDvtt.length === 0}
                      placeholder={
                        !selectedCoQuan
                          ? 'Vui lòng chọn cơ quan đơn vị trước'
                          : filteredDvtt.length === 0
                            ? 'Không có đơn vị trực thuộc nào'
                            : 'Chọn đơn vị trực thuộc'
                      }
                    />
                  </Form.Item>
                )}

                <Form.Item
                  label="Chức vụ"
                  name="chuc_vu_id"
                  rules={[{ required: true, message: 'Vui lòng chọn chức vụ' }]}
                  extra={
                    (selectedRole === ROLES.MANAGER ? !!selectedCoQuan : !!selectedDvtt) &&
                    filteredPositions.length === 0 ? (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        Đơn vị này chưa có chức vụ nào.
                      </Text>
                    ) : undefined
                  }
                >
                  <Select
                    options={filteredPositions.map(p => ({ value: p.id, label: p.ten_chuc_vu }))}
                    disabled={
                      loading ||
                      !(selectedRole === ROLES.MANAGER ? selectedCoQuan : selectedDvtt) ||
                      filteredPositions.length === 0
                    }
                    placeholder={
                      !(selectedRole === ROLES.MANAGER ? selectedCoQuan : selectedDvtt)
                        ? selectedRole === ROLES.MANAGER
                          ? 'Vui lòng chọn cơ quan đơn vị trước'
                          : 'Vui lòng chọn đơn vị trực thuộc trước'
                        : filteredPositions.length === 0
                          ? 'Không có chức vụ nào'
                          : 'Chọn chức vụ'
                    }
                  />
                </Form.Item>

                {selectedRole === ROLES.MANAGER && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Chỉ huy đơn vị gắn ở cấp Cơ quan đơn vị với chức vụ chỉ huy.
                  </Text>
                )}
              </div>
            )}

            <Form.Item className="mt-4">
              <div className="flex justify-end">
                <Space>
                  <Link href={`/super-admin/accounts/${accountId}`}>
                    <Button>Hủy</Button>
                  </Link>
                  <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
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
