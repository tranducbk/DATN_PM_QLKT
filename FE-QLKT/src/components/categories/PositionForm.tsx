'use client';

import { useState, useEffect } from 'react';
import { Form, AutoComplete, Input, Button, Space, Select, Checkbox, message, Typography } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { capitalizeFirst } from '@/lib/utils';

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
  const [positionSuggestions, setPositionSuggestions] = useState<string[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<{ value: string }[]>([]);

  useEffect(() => {
    apiClient.getPositions().then(res => {
      if (res.success && Array.isArray(res.data)) {
        const unique = Array.from(new Set((res.data as { ten_chuc_vu: string }[]).map(p => p.ten_chuc_vu))).sort();
        setPositionSuggestions(unique);
      }
    });
  }, []);

  const isDonViTrucThuoc =
    (units.length === 1 && !!units[0].co_quan_don_vi_id) ||
    !!position?.DonViTrucThuoc ||
    !!position?.don_vi_truc_thuoc_id;

  useEffect(() => {
    if (position) {
      form.setFieldsValue({
        don_vi_id: position.don_vi_id?.toString() || undefined,
        ten_chuc_vu: position.ten_chuc_vu || '',
        is_manager: isDonViTrucThuoc ? false : position.is_manager || false,
        he_so_chuc_vu: position.he_so_chuc_vu || undefined,
      });
    } else if (units.length === 1) {
      form.setFieldsValue({
        don_vi_id: units[0].id?.toString(),
        is_manager: false,
      });
    }
  }, [position, units, form, isDonViTrucThuoc]);

  async function onSubmit(values: any) {
    try {
      setLoading(true);

      // Validate don_vi_id when creating a new position (only when multiple units are available)
      if (!position?.id && units.length > 1 && !values.don_vi_id) {
        message.error('Vui lòng chọn đơn vị');
        return;
      }

      // Prepare payload
      const payload: any = {
        ten_chuc_vu: values.ten_chuc_vu,
        // Sub-units have no commander — is_manager is always false
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

      // Include unit_id only on create — string UUID, not parsed
      if (!position?.id) {
        if (units.length === 1) {
          payload.unit_id = units[0].id.toString();
        } else if (values.don_vi_id) {
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
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, 'Có lỗi xảy ra');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off" size="large">
      <Form.Item
        label="Tên Chức vụ"
        name="ten_chuc_vu"
        rules={[{ required: true, message: 'Vui lòng nhập tên chức vụ' }]}
      >
        <AutoComplete
          placeholder="Nhập tên chức vụ"
          options={filteredOptions}
          onSearch={text => {
            const normalized = capitalizeFirst(text);
            form.setFieldValue('ten_chuc_vu', normalized);
            setFilteredOptions(
              positionSuggestions
                .filter(s => s.toLowerCase().includes(text.toLowerCase()))
                .map(s => ({ value: s }))
            );
          }}
          onSelect={value => form.setFieldValue('ten_chuc_vu', capitalizeFirst(value))}
          onBlur={() => {
            const current = form.getFieldValue('ten_chuc_vu');
            if (current) form.setFieldValue('ten_chuc_vu', capitalizeFirst(current));
          }}
        />
      </Form.Item>

      {!position?.id && (
        <>
          {units.length === 1 ? (
            <>
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
                    <span style={{ marginLeft: 8 }}>
                      • Trực thuộc: {units[0].co_quan_don_vi.ten_don_vi}
                    </span>
                  )}
                </Text>
              </Form.Item>
            </>
          ) : (
            <Form.Item
              label="Đơn vị"
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

      <Form.Item label="Hệ số chức vụ" name="he_so_chuc_vu" extra="Mặc định là 0 nếu để trống">
        <Input type="number" placeholder="Nhập hệ số chức vụ (VD: 1.0)" step="0.01" min="0" />
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
