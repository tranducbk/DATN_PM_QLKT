'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, Space, Select, Checkbox, message, Typography } from 'antd';
import { apiClient } from '@/lib/api-client';

const { Text } = Typography;

interface PositionFormProps {
  position?: any;
  units?: any[];
  onSuccess?: () => void;
  onClose?: () => void;
}

export function PositionForm({ position, units = [], onSuccess, onClose }: PositionFormProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Xác định xem đơn vị có phải là đơn vị trực thuộc không
  const isDonViTrucThuoc = units.length === 1 && !!units[0].co_quan_don_vi_id;

  useEffect(() => {
    if (position) {
      form.setFieldsValue({
        don_vi_id: position.don_vi_id?.toString() || undefined,
        ten_chuc_vu: position.ten_chuc_vu || '',
        // Nếu là đơn vị trực thuộc thì luôn set is_manager = false
        is_manager: isDonViTrucThuoc ? false : position.is_manager || false,
        he_so_chuc_vu: position.he_so_chuc_vu || undefined,
      });
    } else if (units.length === 1) {
      // Nếu chỉ có 1 đơn vị (đang tạo từ trang chi tiết), tự động set don_vi_id
      form.setFieldsValue({
        don_vi_id: units[0].id?.toString(),
        // Đơn vị trực thuộc mặc định is_manager = false
        is_manager: false,
      });
    }
  }, [position, units, form, isDonViTrucThuoc]);

  async function onSubmit(values: any) {
    try {
      setLoading(true);

      // Validate don_vi_id when creating new position (chỉ khi có nhiều đơn vị để chọn)
      if (!position?.id && units.length > 1 && !values.don_vi_id) {
        message.error('Vui lòng chọn đơn vị');
        return;
      }

      // Prepare payload
      const payload: any = {
        ten_chuc_vu: values.ten_chuc_vu,
        // Nếu là đơn vị trực thuộc thì luôn is_manager = false, không có chỉ huy
        is_manager: isDonViTrucThuoc ? false : values.is_manager || false,
      };

      // Add optional fields
      if (
        values.he_so_chuc_vu !== undefined &&
        values.he_so_chuc_vu !== null &&
        values.he_so_chuc_vu !== ''
      ) {
        payload.he_so_chuc_vu = parseFloat(values.he_so_chuc_vu);
      }

      // Add unit_id only when creating (giữ nguyên string UUID)
      if (!position?.id) {
        // Nếu chỉ có 1 đơn vị (tạo từ trang chi tiết), dùng đơn vị đó
        if (units.length === 1) {
          payload.unit_id = units[0].id.toString();
        } else if (values.don_vi_id) {
          // Nếu có nhiều đơn vị, dùng giá trị từ form
          payload.unit_id = values.don_vi_id.toString();
        }
      }

      let res;
      if (position?.id) {
        res = await apiClient.updatePosition(position.id.toString(), payload);
      } else {
        res = await apiClient.createPosition(payload);
      }

      if (res.success) {
        message.success(position?.id ? 'Cập nhật chức vụ thành công' : 'Tạo chức vụ thành công');
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

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off">
      <Form.Item
        label="Tên Chức vụ"
        name="ten_chuc_vu"
        rules={[{ required: true, message: 'Vui lòng nhập tên chức vụ' }]}
      >
        <Input placeholder="Nhập tên chức vụ" />
      </Form.Item>

      {!position?.id && (
        <>
          {/* Nếu chỉ có 1 đơn vị (tạo từ trang chi tiết), hiển thị thông tin đơn vị thay vì dropdown */}
          {units.length === 1 ? (
            <>
              {/* Hiển thị cơ quan đơn vị nếu đơn vị hiện tại là đơn vị trực thuộc */}
              {units[0].co_quan_don_vi && (
                <Form.Item label="Cơ quan đơn vị">
                  <Text type="secondary">
                    <strong>{units[0].co_quan_don_vi.ten_don_vi}</strong> (
                    {units[0].co_quan_don_vi.ma_don_vi})
                  </Text>
                </Form.Item>
              )}
              <Form.Item label={units[0].co_quan_don_vi ? 'Đơn vị trực thuộc' : 'Đơn vị'}>
                <Text type="secondary">
                  <strong>{units[0].ten_don_vi}</strong> ({units[0].ma_don_vi})
                  {units[0].co_quan_don_vi && (
                    <span style={{ marginLeft: 8, color: '#999' }}>
                      • Trực thuộc: {units[0].co_quan_don_vi.ten_don_vi}
                    </span>
                  )}
                </Text>
              </Form.Item>
            </>
          ) : (
            <Form.Item
              label={
                <span>
                  Đơn vị <span style={{ color: 'red' }}>*</span>
                </span>
              }
              name="don_vi_id"
              rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}
            >
              <Select placeholder="Chọn đơn vị">
                {units.map(unit => (
                  <Select.Option key={unit.id} value={unit.id.toString()}>
                    {unit.ten_don_vi}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </>
      )}

      <Form.Item label="Hệ số chức vụ" name="he_so_chuc_vu">
        <Input type="number" placeholder="Nhập hệ số chức vụ (VD: 2.5)" step="0.01" min="0" />
      </Form.Item>

      {/* Chỉ hiển thị checkbox "Là Chỉ huy?" cho CƠ QUAN ĐƠN VỊ */}
      {/* Đơn vị trực thuộc KHÔNG có chỉ huy, luôn là false */}
      {!isDonViTrucThuoc && (
        <Form.Item name="is_manager" valuePropName="checked">
          <Checkbox>Là Chỉ huy?</Checkbox>
        </Form.Item>
      )}

      {/* Hiển thị thông báo nếu là đơn vị trực thuộc */}
      {isDonViTrucThuoc && (
        <Form.Item>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Đơn vị trực thuộc không có chức vụ chỉ huy. Chỉ cơ quan đơn vị mới có chỉ huy.
          </Text>
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {position ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
