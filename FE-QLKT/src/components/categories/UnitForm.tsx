'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, Space, message, Select, Typography } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';

const { Text } = Typography;

interface UnitFormProps {
  unit?: any;
  units?: any[];
  onSuccess?: () => void;
  onClose?: () => void;
}

export function UnitForm({ unit, units = [], onSuccess, onClose }: UnitFormProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (unit) {
      if (unit.id) {
        form.setFieldsValue({
          ma_don_vi: unit.ma_don_vi || '',
          ten_don_vi: unit.ten_don_vi || '',
          co_quan_don_vi_id: unit.co_quan_don_vi_id ? unit.co_quan_don_vi_id.toString() : undefined,
        });
      } else if (unit.co_quan_don_vi_id) {
        form.resetFields();
        form.setFieldsValue({
          co_quan_don_vi_id: unit.co_quan_don_vi_id.toString(),
        });
      } else {
        form.resetFields();
      }
    } else {
      form.resetFields();
    }
  }, [unit, form]);

  async function onSubmit(values: any) {
    try {
      setLoading(true);

      const payload: any = {
        ma_don_vi: values.ma_don_vi,
        ten_don_vi: values.ten_don_vi,
      };

      if (values.co_quan_don_vi_id) {
        payload.co_quan_don_vi_id = values.co_quan_don_vi_id.toString();
      } else if (unit?.co_quan_don_vi_id && !unit?.id) {
        payload.co_quan_don_vi_id = unit.co_quan_don_vi_id.toString();
      } else if (unit?.id && !values.co_quan_don_vi_id) {
        payload.co_quan_don_vi_id = null;
      }

      const res = unit?.id
        ? await apiClient.updateUnit(unit.id.toString(), payload)
        : await apiClient.createUnit(payload);

      if (!res.success) {
        message.error(res.message || 'Có lỗi xảy ra');
        return;
      }
      const isDVTT = unit?.co_quan_don_vi_id;
      const isEdit = !!unit?.id;
      message.success(
        isEdit
          ? isDVTT ? 'Cập nhật đơn vị trực thuộc thành công' : 'Cập nhật cơ quan đơn vị thành công'
          : isDVTT ? 'Tạo đơn vị trực thuộc thành công' : 'Tạo cơ quan đơn vị thành công'
      );
      onSuccess?.();
      onClose?.();
    } catch (error: unknown) {
      const errorMessage =
        getApiErrorMessage(error, 'Có lỗi xảy ra');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Exclude the current unit from the parent list to prevent circular references
  const availableParentUnits = units.filter(u => u.id !== unit?.id);

  const isDonViTrucThuoc = !!unit?.co_quan_don_vi_id;

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off" size="large">
      <Form.Item
        label={isDonViTrucThuoc ? 'Mã Đơn vị trực thuộc' : 'Mã Cơ quan đơn vị'}
        name="ma_don_vi"
        rules={[
          {
            required: true,
            message: isDonViTrucThuoc
              ? 'Vui lòng nhập mã đơn vị trực thuộc'
              : 'Vui lòng nhập mã cơ quan đơn vị',
          },
        ]}
      >
        <Input
          placeholder={isDonViTrucThuoc ? 'Nhập mã đơn vị trực thuộc' : 'Nhập mã cơ quan đơn vị'}
        />
      </Form.Item>

      <Form.Item
        label={isDonViTrucThuoc ? 'Tên Đơn vị trực thuộc' : 'Tên Cơ quan đơn vị'}
        name="ten_don_vi"
        rules={[
          {
            required: true,
            message: isDonViTrucThuoc
              ? 'Vui lòng nhập tên đơn vị trực thuộc'
              : 'Vui lòng nhập tên cơ quan đơn vị',
          },
        ]}
      >
        <Input
          placeholder={isDonViTrucThuoc ? 'Nhập tên đơn vị trực thuộc' : 'Nhập tên cơ quan đơn vị'}
        />
      </Form.Item>

      {/* Show the agency-unit field only when EDITING a unit (has id) that has a co_quan_don_vi_id.
          On CREATE from the categories page: hidden (only creating an agency unit).
          On CREATE from the detail page: agency unit info shown read-only. */}
      {unit?.id && unit?.co_quan_don_vi_id && (
        <Form.Item
          label="Cơ quan đơn vị"
          name="co_quan_don_vi_id"
          tooltip="Chọn cơ quan đơn vị nếu đây là đơn vị trực thuộc. Để trống nếu là cơ quan đơn vị cấp cao nhất."
        >
          <Select
            placeholder="Chọn cơ quan đơn vị (tùy chọn)"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {availableParentUnits.map(u => (
              <Select.Option key={u.id} value={u.id.toString()}>
                {u.ten_don_vi} ({u.ma_don_vi})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}

      {/* Show agency-unit info when creating a subordinate unit (has co_quan_don_vi_id but no id yet) */}
      {unit && unit.co_quan_don_vi_id && !unit.id && (
        <Form.Item label="Cơ quan đơn vị">
          <Text type="secondary">
            Đơn vị trực thuộc của:{' '}
            <strong>
              {units.find(u => u.id === unit.co_quan_don_vi_id)?.ten_don_vi || 'Đang tải...'}
            </strong>
          </Text>
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {unit?.id ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
