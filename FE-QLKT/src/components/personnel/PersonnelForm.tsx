'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, App } from 'antd';
import type { z } from 'zod';
import { personnelFormSchema } from '@/lib/schemas';
import { apiClient } from '@/lib/http/apiClient';
import { capitalizeWords } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/http/apiError';

type PersonnelFormValues = z.infer<typeof personnelFormSchema>;

interface UnitOption {
  id: string | number;
  ten_don_vi?: string | null;
  ma_don_vi?: string | null;
}

interface PositionOption {
  id: string | number;
  ten_chuc_vu?: string | null;
}

interface PersonnelInput {
  id?: string;
  cccd?: string | null;
  ho_ten?: string | null;
  co_quan_don_vi_id?: string | number | null;
  don_vi_truc_thuoc_id?: string | number | null;
  chuc_vu_id?: string | number | null;
  ngay_nhap_ngu?: string | null;
  ngay_sinh?: string | null;
}

interface PersonnelFormProps {
  personnel?: PersonnelInput;
  coQuanDonViList?: UnitOption[];
  donViTrucThuocList?: UnitOption[];
  positions?: PositionOption[];
  onSuccess?: (data: PersonnelFormValues) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

export function PersonnelForm({
  personnel,
  coQuanDonViList = [],
  donViTrucThuocList = [],
  positions = [],
  onSuccess,
  onClose,
  readOnly = false,
}: PersonnelFormProps) {
  const [form] = Form.useForm<PersonnelFormValues>();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const initialValues: PersonnelFormValues = {
    cccd: personnel?.cccd ?? '',
    ho_ten: personnel?.ho_ten ?? '',
    co_quan_don_vi_id: personnel?.co_quan_don_vi_id?.toString() ?? '',
    don_vi_truc_thuoc_id: personnel?.don_vi_truc_thuoc_id?.toString() ?? '',
    chuc_vu_id: personnel?.chuc_vu_id?.toString() ?? '',
    ngay_nhap_ngu: personnel?.ngay_nhap_ngu ?? '',
    ngay_sinh: personnel?.ngay_sinh ?? '',
  };

  const handleFinish = async (values: PersonnelFormValues) => {
    try {
      setLoading(true);
      const result = personnel?.id
        ? await apiClient.updatePersonnel(personnel.id, values)
        : await apiClient.createPersonnel(values);

      if (!result.success) {
        message.error(
          result.message || `Có lỗi xảy ra khi ${personnel?.id ? 'cập nhật' : 'tạo'} quân nhân`
        );
        return;
      }
      message.success(`${personnel?.id ? 'Cập nhật' : 'Tạo'} quân nhân thành công`);
      onSuccess?.(values);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<PersonnelFormValues>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleFinish}
      disabled={readOnly}
    >
      <Form.Item
        label="CCCD"
        name="cccd"
        rules={[
          { required: true, message: 'CCCD là bắt buộc' },
          { min: 9, message: 'CCCD phải có ít nhất 9 ký tự' },
        ]}
      >
        <Input placeholder="Nhập CCCD" />
      </Form.Item>

      <Form.Item
        label="Họ tên"
        name="ho_ten"
        rules={[{ required: true, message: 'Họ tên là bắt buộc' }]}
      >
        <Input
          placeholder="Nhập họ tên"
          onChange={e => form.setFieldValue('ho_ten', capitalizeWords(e.target.value))}
        />
      </Form.Item>

      <Form.Item label="Ngày sinh" name="ngay_sinh">
        <Input type="date" />
      </Form.Item>

      <Form.Item
        label="Cơ quan đơn vị"
        name="co_quan_don_vi_id"
        rules={[
          {
            validator: () =>
              form.getFieldValue('co_quan_don_vi_id') || form.getFieldValue('don_vi_truc_thuoc_id')
                ? Promise.resolve()
                : Promise.reject(new Error('Vui lòng chọn cơ quan đơn vị hoặc đơn vị trực thuộc')),
          },
        ]}
      >
        <Select
          placeholder="Chọn cơ quan đơn vị"
          allowClear
          onChange={value => {
            if (value) form.setFieldValue('don_vi_truc_thuoc_id', '');
          }}
          options={coQuanDonViList.map(unit => ({
            value: unit.id.toString(),
            label: `${unit.ten_don_vi || ''} (${unit.ma_don_vi || ''})`,
          }))}
        />
      </Form.Item>

      <Form.Item label="Đơn vị trực thuộc" name="don_vi_truc_thuoc_id">
        <Select
          placeholder="Chọn đơn vị trực thuộc"
          allowClear
          onChange={value => {
            if (value) form.setFieldValue('co_quan_don_vi_id', '');
            form.validateFields(['co_quan_don_vi_id']).catch(() => {});
          }}
          options={donViTrucThuocList.map(unit => ({
            value: unit.id.toString(),
            label: `${unit.ten_don_vi || ''} (${unit.ma_don_vi || ''})`,
          }))}
        />
      </Form.Item>

      <Form.Item
        label="Chức vụ"
        name="chuc_vu_id"
        rules={[{ required: true, message: 'Chức vụ là bắt buộc' }]}
      >
        <Select
          placeholder="Chọn chức vụ"
          options={positions.map(pos => ({
            value: pos.id.toString(),
            label: pos.ten_chuc_vu || '',
          }))}
        />
      </Form.Item>

      <Form.Item
        label="Ngày nhập ngũ"
        name="ngay_nhap_ngu"
        rules={[{ required: true, message: 'Ngày nhập ngũ là bắt buộc' }]}
      >
        <Input type="date" />
      </Form.Item>

      <div className="flex gap-2 justify-end pt-4">
        {readOnly ? (
          <Button disabled={false} onClick={onClose}>
            Đóng
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {personnel ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
