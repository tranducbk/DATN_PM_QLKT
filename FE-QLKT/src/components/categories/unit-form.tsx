'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, Space, message, Select, Typography } from 'antd';
import { apiClient } from '@/lib/api-client';

const { Text } = Typography;

interface UnitFormProps {
  unit?: any;
  units?: any[]; // Danh sách đơn vị để chọn làm đơn vị cha
  onSuccess?: () => void;
  onClose?: () => void;
}

export function UnitForm({ unit, units = [], onSuccess, onClose }: UnitFormProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (unit) {
      // Nếu unit có id thì đang sửa, nếu không có id nhưng có co_quan_don_vi_id thì đang tạo đơn vị trực thuộc
      if (unit.id) {
        form.setFieldsValue({
          ma_don_vi: unit.ma_don_vi || '',
          ten_don_vi: unit.ten_don_vi || '',
          co_quan_don_vi_id: unit.co_quan_don_vi_id ? unit.co_quan_don_vi_id.toString() : undefined,
        });
      } else if (unit.co_quan_don_vi_id) {
        // Đang tạo đơn vị trực thuộc, reset form và set co_quan_don_vi_id
        form.resetFields();
        form.setFieldsValue({
          co_quan_don_vi_id: unit.co_quan_don_vi_id.toString(),
        });
      } else {
        // Tạo mới cơ quan đơn vị (không có co_quan_don_vi_id)
        form.resetFields();
      }
    } else {
      // Không có unit, reset form
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

      // Thêm co_quan_don_vi_id nếu có
      if (values.co_quan_don_vi_id) {
        payload.co_quan_don_vi_id = values.co_quan_don_vi_id.toString(); // Giữ nguyên string vì có thể là UUID
      } else if (unit?.co_quan_don_vi_id && !unit?.id) {
        // Nếu đang tạo đơn vị trực thuộc (có co_quan_don_vi_id nhưng chưa có id)
        payload.co_quan_don_vi_id = unit.co_quan_don_vi_id.toString();
      } else if (unit?.id && !values.co_quan_don_vi_id) {
        // Nếu đang sửa và không chọn co_quan_don_vi_id, set null
        payload.co_quan_don_vi_id = null;
      }

      let res;
      if (unit?.id) {
        res = await apiClient.updateUnit(unit.id.toString(), payload);
      } else {
        res = await apiClient.createUnit(payload);
      }

      if (res.success) {
        message.success(
          unit?.id
            ? unit.co_quan_don_vi_id
              ? 'Cập nhật đơn vị trực thuộc thành công'
              : 'Cập nhật cơ quan đơn vị thành công'
            : unit?.co_quan_don_vi_id
            ? 'Tạo đơn vị trực thuộc thành công'
            : 'Tạo cơ quan đơn vị thành công'
        );
        onSuccess?.();
        onClose?.();
      } else {
        message.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Có lỗi xảy ra';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Lọc bỏ đơn vị hiện tại khỏi danh sách đơn vị cha (tránh vòng lặp)
  const availableParentUnits = units.filter(u => u.id !== unit?.id);

  // Xác định loại đơn vị: nếu có co_quan_don_vi_id thì là đơn vị trực thuộc, ngược lại là cơ quan đơn vị
  const isDonViTrucThuoc = !!unit?.co_quan_don_vi_id;

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off">
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
          placeholder={
            isDonViTrucThuoc ? 'Nhập mã đơn vị trực thuộc' : 'Nhập mã cơ quan đơn vị'
          }
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
          placeholder={
            isDonViTrucThuoc ? 'Nhập tên đơn vị trực thuộc' : 'Nhập tên cơ quan đơn vị'
          }
        />
      </Form.Item>

      {/* Chỉ hiển thị field Cơ quan đơn vị khi SỬA đơn vị (có id) và đơn vị đó có co_quan_don_vi_id */}
      {/* Khi TẠO MỚI ở trang categories: không hiển thị (chỉ tạo cơ quan đơn vị) */}
      {/* Khi TẠO MỚI ở trang chi tiết: hiển thị thông tin cơ quan đơn vị (read-only) */}
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

      {/* Hiển thị thông tin cơ quan đơn vị nếu đang tạo đơn vị trực thuộc (có co_quan_don_vi_id nhưng chưa có id) */}
      {unit && unit.co_quan_don_vi_id && !unit.id && (
        <Form.Item label="Cơ quan đơn vị">
          <Text type="secondary">
            Đơn vị trực thuộc của:{' '}
            <strong>{units.length > 0 ? units[0].ten_don_vi : 'Đang tải...'}</strong>
          </Text>
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {unit ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
