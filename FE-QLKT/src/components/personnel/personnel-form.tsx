'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { personnelFormSchema } from '@/lib/schemas';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

type PersonnelFormValues = z.infer<typeof personnelFormSchema>;

interface PersonnelFormProps {
  personnel?: any;
  coQuanDonViList?: any[];
  donViTrucThuocList?: any[];
  positions?: any[];
  onSuccess?: (data?: any) => void;
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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelFormSchema),
    defaultValues: {
      cccd: personnel?.cccd || '',
      ho_ten: personnel?.ho_ten || '',
      co_quan_don_vi_id: personnel?.co_quan_don_vi_id?.toString() || '',
      don_vi_truc_thuoc_id: personnel?.don_vi_truc_thuoc_id?.toString() || '',
      chuc_vu_id: personnel?.chuc_vu_id?.toString() || '',
      ngay_nhap_ngu: personnel?.ngay_nhap_ngu || '',
      ngay_sinh: personnel?.ngay_sinh || '',
    },
  });

  async function onSubmit(values: PersonnelFormValues) {
    try {
      setLoading(true);
      if (personnel?.id) {
        const result = await apiClient.updatePersonnel(personnel.id, values);
        if (result.success) {
          toast({
            title: 'Thành công',
            description: 'Cập nhật quân nhân thành công',
          });
          onSuccess?.(values);
        } else {
          toast({
            title: 'Lỗi',
            description: result.message || 'Có lỗi xảy ra khi cập nhật quân nhân',
            variant: 'destructive',
          });
        }
      } else {
        const result = await apiClient.createPersonnel(values);
        if (result.success) {
          toast({
            title: 'Thành công',
            description: 'Tạo quân nhân thành công',
          });
          onSuccess?.(values);
        } else {
          toast({
            title: 'Lỗi',
            description: result.message || 'Có lỗi xảy ra khi tạo quân nhân',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Có lỗi xảy ra';

      toast({
        title: 'Lỗi',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="cccd"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CCCD</FormLabel>
              <FormControl>
                <Input placeholder="Nhập CCCD" {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ho_ten"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ tên</FormLabel>
              <FormControl>
                <Input placeholder="Nhập họ tên" {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ngay_sinh"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày sinh</FormLabel>
              <FormControl>
                <Input type="date" {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="co_quan_don_vi_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cơ quan đơn vị</FormLabel>
              <Select
                onValueChange={value => {
                  field.onChange(value);
                  // Clear don_vi_truc_thuoc_id khi chọn cơ quan đơn vị
                  form.setValue('don_vi_truc_thuoc_id', '');
                }}
                value={field.value}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn cơ quan đơn vị" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {coQuanDonViList.map(unit => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>
                      {unit.ten_don_vi} ({unit.ma_don_vi})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="don_vi_truc_thuoc_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Đơn vị trực thuộc</FormLabel>
              <Select
                onValueChange={value => {
                  field.onChange(value);
                  // Clear co_quan_don_vi_id khi chọn đơn vị trực thuộc
                  form.setValue('co_quan_don_vi_id', '');
                }}
                value={field.value}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đơn vị trực thuộc" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {donViTrucThuocList.map(unit => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>
                      {unit.ten_don_vi} ({unit.ma_don_vi})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="chuc_vu_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chức vụ</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {positions.map(pos => (
                    <SelectItem key={pos.id} value={pos.id.toString()}>
                      {pos.ten_chuc_vu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ngay_nhap_ngu"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày nhập ngũ</FormLabel>
              <FormControl>
                <Input type="date" {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!readOnly && (
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang xử lý...' : personnel ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
