'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Select, Button, message, Typography } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, roleSelectOptions } from '@/constants/roles.constants';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ManagerPositionRow, UnitApiRow } from '@/lib/types/personnelList';

const { Text } = Typography;

interface AccountCoQuanDonViOption {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
}

interface AccountDonViTrucThuocOption extends AccountCoQuanDonViOption {
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id: string; ten_don_vi: string } | null;
}

interface CreateFormValues {
  role: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
}

export function AccountCreateForm() {
  const [form] = Form.useForm<CreateFormValues>();
  const [loading, setLoading] = useState(false);
  const [coQuanDonViList, setCoQuanDonViList] = useState<AccountCoQuanDonViOption[]>([]);
  const [donViTrucThuocList, setDonViTrucThuocList] = useState<AccountDonViTrucThuocOption[]>([]);
  const [positions, setPositions] = useState<ManagerPositionRow[]>([]);
  const router = useRouter();
  const { user } = useAuth();
  const currentUserRole = user?.role || '';

  const selectedRole = Form.useWatch('role', form);
  const selectedCoQuanDonViId = Form.useWatch('co_quan_don_vi_id', form);
  const selectedDonViTrucThuocId = Form.useWatch('don_vi_truc_thuoc_id', form);

  useEffect(() => {
    fetchUnitsAndPositions();
  }, []);

  const fetchUnitsAndPositions = async () => {
    try {
      const [unitsRes, positionsRes] = await Promise.all([
        apiClient.getUnits({ hierarchy: true }),
        apiClient.getPositions(),
      ]);
      if (unitsRes.success) {
        const unitsData = (unitsRes.data || []) as UnitApiRow[];
        const coQuanDonVi: AccountCoQuanDonViOption[] = [];
        const donViTrucThuoc: AccountDonViTrucThuocOption[] = [];
        unitsData.forEach((unit: UnitApiRow) => {
          coQuanDonVi.push({
            id: unit.id,
            ten_don_vi: unit.ten_don_vi,
            ma_don_vi: unit.ma_don_vi ?? '',
          });
          (unit.DonViTrucThuoc || []).forEach((dv: UnitApiRow) => {
            donViTrucThuoc.push({
              id: dv.id,
              ten_don_vi: dv.ten_don_vi,
              ma_don_vi: dv.ma_don_vi ?? '',
              co_quan_don_vi_id: unit.id,
              CoQuanDonVi: { id: unit.id, ten_don_vi: unit.ten_don_vi },
            });
          });
        });
        setCoQuanDonViList(coQuanDonVi);
        setDonViTrucThuocList(donViTrucThuoc);
      }
      if (positionsRes.success) {
        setPositions((positionsRes.data || []) as ManagerPositionRow[]);
      }
    } catch {}
  };

  const filteredDonViTrucThuoc =
    selectedRole === ROLES.USER && selectedCoQuanDonViId
      ? donViTrucThuocList.filter(dv => dv.co_quan_don_vi_id === selectedCoQuanDonViId)
      : [];

  const filteredPositions = (() => {
    if (selectedRole === ROLES.MANAGER && selectedCoQuanDonViId) {
      return positions.filter(p => p.co_quan_don_vi_id === selectedCoQuanDonViId);
    }
    if (selectedRole === ROLES.USER && selectedDonViTrucThuocId) {
      return positions.filter(p => p.don_vi_truc_thuoc_id === selectedDonViTrucThuocId);
    }
    return [];
  })();

  useEffect(() => {
    if (selectedCoQuanDonViId !== undefined) {
      form.setFieldsValue({ chuc_vu_id: undefined });
      if (selectedRole === ROLES.USER) {
        form.setFieldsValue({ don_vi_truc_thuoc_id: undefined });
      }
    }
  }, [selectedCoQuanDonViId, selectedRole, form]);

  useEffect(() => {
    if (selectedRole === ROLES.USER && selectedDonViTrucThuocId !== undefined) {
      form.setFieldsValue({ chuc_vu_id: undefined });
    }
  }, [selectedDonViTrucThuocId, selectedRole, form]);

  const getAvailableRoles = () => {
    if (currentUserRole === ROLES.SUPER_ADMIN) {
      return roleSelectOptions([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]);
    }
    if (currentUserRole === ROLES.ADMIN) {
      return roleSelectOptions([ROLES.MANAGER, ROLES.USER]);
    }
    return roleSelectOptions([ROLES.USER]);
  };

  const canSubmit = () => {
    if (selectedRole === ROLES.MANAGER) {
      return coQuanDonViList.length > 0 && !!selectedCoQuanDonViId && filteredPositions.length > 0;
    }
    if (selectedRole === ROLES.USER) {
      return (
        coQuanDonViList.length > 0 &&
        !!selectedCoQuanDonViId &&
        filteredDonViTrucThuoc.length > 0 &&
        !!selectedDonViTrucThuocId &&
        filteredPositions.length > 0
      );
    }
    return true;
  };

  const getSubmitButtonTooltip = () => {
    if (selectedRole === ROLES.MANAGER) {
      if (coQuanDonViList.length === 0)
        return 'Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.';
      if (!selectedCoQuanDonViId) return 'Vui lòng chọn Cơ quan đơn vị cho tài khoản MANAGER.';
      if (filteredPositions.length === 0)
        return 'Cơ quan đơn vị này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.';
    } else if (selectedRole === ROLES.USER) {
      if (coQuanDonViList.length === 0)
        return 'Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.';
      if (!selectedCoQuanDonViId) return 'Vui lòng chọn Cơ quan đơn vị cho tài khoản USER.';
      if (filteredDonViTrucThuoc.length === 0)
        return 'Cơ quan đơn vị này chưa có đơn vị trực thuộc. Vui lòng tạo đơn vị trực thuộc trước.';
      if (!selectedDonViTrucThuocId) return 'Vui lòng chọn Đơn vị trực thuộc cho tài khoản USER.';
      if (filteredPositions.length === 0)
        return 'Đơn vị trực thuộc này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.';
    }
    return '';
  };

  const onFinish = async (values: CreateFormValues) => {
    try {
      setLoading(true);
      const { confirmPassword, ...rest } = values;
      void confirmPassword;
      const response = await apiClient.createAccount({ ...rest, password: rest.password ?? '' });
      if (response.success) {
        message.success('Tạo tài khoản thành công');
        if (currentUserRole === ROLES.SUPER_ADMIN) {
          router.push('/super-admin/accounts');
        } else {
          router.push('/admin/accounts');
        }
      } else {
        message.error(response.message || 'Có lỗi xảy ra khi tạo tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi tạo tài khoản'));
    } finally {
      setLoading(false);
    }
  };

  const showUnitSection = selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER;

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{ role: ROLES.USER }}
      className="space-y-2"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold mb-4">Thông tin tài khoản</h3>

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

        <Form.Item
          label="Tên đăng nhập"
          name="username"
          rules={[
            { required: true, message: 'Vui lòng nhập tên đăng nhập' },
            { min: 3, message: 'Tên đăng nhập phải có ít nhất 3 ký tự' },
          ]}
          extra={
            selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khuyến nghị: Sử dụng số CCCD của quân nhân làm tên đăng nhập
              </Text>
            ) : undefined
          }
        >
          <Input placeholder="Nhập tên đăng nhập" disabled={loading} />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (
                  value.length < 8 ||
                  !/[A-Z]/.test(value) ||
                  !/[a-z]/.test(value) ||
                  !/[0-9]/.test(value)
                ) {
                  return Promise.reject(
                    'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số'
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Để trống sẽ sử dụng mật khẩu mặc định của hệ thống
            </Text>
          }
        >
          <Input.Password placeholder="Nhập mật khẩu" disabled={loading} />
        </Form.Item>

        <Form.Item
          label="Xác nhận mật khẩu"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const pwd = getFieldValue('password');
                if (!pwd || !value || pwd === value) return Promise.resolve();
                return Promise.reject('Mật khẩu xác nhận không khớp');
              },
            }),
          ]}
        >
          <Input.Password placeholder="Nhập lại mật khẩu" disabled={loading} />
        </Form.Item>
      </div>

      {showUnitSection && (
        <div className="border-t pt-4 space-y-1">
          <h3 className="text-lg font-semibold mb-4">Thông tin đơn vị và chức vụ</h3>

          <Form.Item
            label="Cơ quan đơn vị"
            name="co_quan_don_vi_id"
            rules={[{ required: true, message: 'Vui lòng chọn cơ quan đơn vị' }]}
            extra={
              coQuanDonViList.length === 0 ? (
                <Text type="danger" style={{ fontSize: 12 }}>
                  Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.
                </Text>
              ) : undefined
            }
          >
            <Select
              options={coQuanDonViList.map(u => ({ value: u.id, label: u.ten_don_vi }))}
              disabled={loading || coQuanDonViList.length === 0}
              placeholder={
                coQuanDonViList.length === 0 ? 'Không có cơ quan đơn vị nào' : 'Chọn cơ quan đơn vị'
              }
            />
          </Form.Item>

          {selectedRole === ROLES.USER && (
            <Form.Item
              label="Đơn vị trực thuộc"
              name="don_vi_truc_thuoc_id"
              rules={[{ required: true, message: 'Vui lòng chọn đơn vị trực thuộc' }]}
              extra={
                selectedCoQuanDonViId && filteredDonViTrucThuoc.length === 0 ? (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Cơ quan đơn vị này chưa có đơn vị trực thuộc. Vui lòng tạo đơn vị trực thuộc
                    trước.
                  </Text>
                ) : undefined
              }
            >
              <Select
                options={filteredDonViTrucThuoc.map(u => ({ value: u.id, label: u.ten_don_vi }))}
                disabled={loading || !selectedCoQuanDonViId || filteredDonViTrucThuoc.length === 0}
                placeholder={
                  !selectedCoQuanDonViId
                    ? 'Vui lòng chọn cơ quan đơn vị trước'
                    : filteredDonViTrucThuoc.length === 0
                      ? 'Không có đơn vị trực thuộc nào'
                      : 'Chọn đơn vị trực thuộc'
                }
              />
            </Form.Item>
          )}

          <Form.Item
            label="Chức vụ"
            name="chuc_vu_id"
            extra={
              (selectedRole === ROLES.MANAGER
                ? !!selectedCoQuanDonViId
                : !!selectedDonViTrucThuocId) && filteredPositions.length === 0 ? (
                <Text type="danger" style={{ fontSize: 12 }}>
                  Đơn vị này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.
                </Text>
              ) : undefined
            }
          >
            <Select
              options={filteredPositions.map(p => ({ value: p.id, label: p.ten_chuc_vu }))}
              disabled={
                loading ||
                !(selectedRole === ROLES.MANAGER
                  ? selectedCoQuanDonViId
                  : selectedDonViTrucThuocId) ||
                filteredPositions.length === 0
              }
              placeholder={
                !(selectedRole === ROLES.MANAGER ? selectedCoQuanDonViId : selectedDonViTrucThuocId)
                  ? selectedRole === ROLES.MANAGER
                    ? 'Vui lòng chọn cơ quan đơn vị trước'
                    : 'Vui lòng chọn đơn vị trực thuộc trước'
                  : filteredPositions.length === 0
                    ? 'Không có chức vụ nào'
                    : 'Chọn chức vụ'
              }
            />
          </Form.Item>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button onClick={() => router.back()} disabled={loading}>
          Hủy
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          disabled={!canSubmit()}
          title={getSubmitButtonTooltip()}
        >
          {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
        </Button>
      </div>
    </Form>
  );
}
