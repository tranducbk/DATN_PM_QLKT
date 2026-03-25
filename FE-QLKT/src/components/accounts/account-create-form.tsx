// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { accountCreateSchema } from '@/lib/schemas';
import { apiClient } from '@/lib/api-client';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { message } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, roleSelectOptions } from '@/constants/roles.constants';
import { getApiErrorMessage } from '@/lib/apiError';

type AccountCreateValues = z.infer<typeof accountCreateSchema>;

export function AccountCreateForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [coQuanDonViList, setCoQuanDonViList] = useState<any[]>([]); // Danh sách Cơ quan đơn vị
  const [donViTrucThuocList, setDonViTrucThuocList] = useState<any[]>([]); // Danh sách Đơn vị trực thuộc (tất cả)
  const [positions, setPositions] = useState<any[]>([]);
  const router = useRouter();
  const { user } = useAuth();
  const currentUserRole = user?.role || '';

  useEffect(() => {
    // Lấy danh sách đơn vị và chức vụ
    fetchUnitsAndPositions();
  }, []);

  const fetchUnitsAndPositions = async () => {
    try {
      const [unitsRes, positionsRes] = await Promise.all([
        apiClient.getUnits(), // Lấy tất cả đơn vị (cả cơ quan đơn vị và đơn vị trực thuộc)
        apiClient.getPositions(),
      ]);

      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];
        const coQuanDonVi: any[] = [];
        const donViTrucThuoc: any[] = [];

        unitsData.forEach((unit: any) => {
          if (unit.co_quan_don_vi_id || unit.CoQuanDonVi) {
            donViTrucThuoc.push({
              id: unit.id,
              ten_don_vi: unit.ten_don_vi,
              ma_don_vi: unit.ma_don_vi,
              co_quan_don_vi_id: unit.co_quan_don_vi_id,
              CoQuanDonVi: unit.CoQuanDonVi || null,
            });
          } else {
            coQuanDonVi.push({
              id: unit.id,
              ten_don_vi: unit.ten_don_vi,
              ma_don_vi: unit.ma_don_vi,
            });
          }
        });

        setCoQuanDonViList(coQuanDonVi);
        setDonViTrucThuocList(donViTrucThuoc);
      }

      if (positionsRes.success) {
        setPositions(positionsRes.data || []);
      }
    } catch {
      // Error handled by UI
    }
  };

  const form = useForm<AccountCreateValues>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      role: ROLES.USER,
    },
  });

  // Watch các fields để filter và validate
  const selectedRole = form.watch('role');
  const selectedCoQuanDonViId = form.watch('co_quan_don_vi_id');
  const selectedDonViTrucThuocId = form.watch('don_vi_truc_thuoc_id');

  // Filter đơn vị trực thuộc theo cơ quan đơn vị đã chọn
  const filteredDonViTrucThuoc =
    selectedRole === ROLES.USER && selectedCoQuanDonViId
      ? donViTrucThuocList.filter(dv => dv.co_quan_don_vi_id === selectedCoQuanDonViId)
      : [];

  // Lọc chức vụ theo đơn vị được chọn
  const filteredPositions = (() => {
    if (selectedRole === ROLES.MANAGER && selectedCoQuanDonViId) {
      // MANAGER: Lọc chức vụ thuộc Cơ quan đơn vị (không bao gồm chức vụ của đơn vị trực thuộc)
      return positions.filter(p => p.co_quan_don_vi_id === selectedCoQuanDonViId);
    } else if (selectedRole === ROLES.USER && selectedDonViTrucThuocId) {
      // USER: Lọc chức vụ thuộc Đơn vị trực thuộc
      return positions.filter(p => p.don_vi_truc_thuoc_id === selectedDonViTrucThuocId);
    }
    return [];
  })();

  // Reset chức vụ và đơn vị trực thuộc khi đổi cơ quan đơn vị
  useEffect(() => {
    if (selectedCoQuanDonViId !== undefined) {
      form.setValue('chuc_vu_id', undefined);
      if (selectedRole === ROLES.USER) {
        form.setValue('don_vi_truc_thuoc_id', undefined);
      }
    }
  }, [selectedCoQuanDonViId, selectedRole, form]);

  // Reset chức vụ khi đổi đơn vị trực thuộc (USER)
  useEffect(() => {
    if (selectedRole === ROLES.USER && selectedDonViTrucThuocId !== undefined) {
      form.setValue('chuc_vu_id', undefined);
    }
  }, [selectedDonViTrucThuocId, selectedRole, form]);

  // Lấy danh sách role có thể tạo dựa trên role hiện tại
  const getAvailableRoles = () => {
    if (currentUserRole === ROLES.SUPER_ADMIN) {
      return roleSelectOptions([
        ROLES.SUPER_ADMIN,
        ROLES.ADMIN,
        ROLES.MANAGER,
        ROLES.USER,
      ]);
    }
    if (currentUserRole === ROLES.ADMIN) {
      return roleSelectOptions([ROLES.MANAGER, ROLES.USER]);
    }
    return roleSelectOptions([ROLES.USER]);
  };

  // Kiểm tra xem có thể submit form không
  const canSubmit = () => {
    if (selectedRole === ROLES.MANAGER) {
      // MANAGER: Cần có co_quan_don_vi_id và chuc_vu_id
      return (
        coQuanDonViList.length > 0 &&
        selectedCoQuanDonViId !== undefined &&
        filteredPositions.length > 0
      );
    } else if (selectedRole === ROLES.USER) {
      // USER: Cần có co_quan_don_vi_id, don_vi_truc_thuoc_id và chuc_vu_id
      return (
        coQuanDonViList.length > 0 &&
        selectedCoQuanDonViId !== undefined &&
        filteredDonViTrucThuoc.length > 0 &&
        selectedDonViTrucThuocId !== undefined &&
        filteredPositions.length > 0
      );
    }
    // SUPER_ADMIN và ADMIN không cần đơn vị
    return true;
  };

  // Tooltip cho button submit
  const getSubmitButtonTooltip = () => {
    if (selectedRole === ROLES.MANAGER) {
      if (coQuanDonViList.length === 0) {
        return 'Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.';
      }
      if (!selectedCoQuanDonViId) {
        return 'Vui lòng chọn Cơ quan đơn vị cho tài khoản MANAGER.';
      }
      if (filteredPositions.length === 0) {
        return 'Cơ quan đơn vị này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.';
      }
    } else if (selectedRole === ROLES.USER) {
      if (coQuanDonViList.length === 0) {
        return 'Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.';
      }
      if (!selectedCoQuanDonViId) {
        return 'Vui lòng chọn Cơ quan đơn vị cho tài khoản USER.';
      }
      if (filteredDonViTrucThuoc.length === 0) {
        return 'Cơ quan đơn vị này chưa có đơn vị trực thuộc. Vui lòng tạo đơn vị trực thuộc trước.';
      }
      if (!selectedDonViTrucThuocId) {
        return 'Vui lòng chọn Đơn vị trực thuộc cho tài khoản USER.';
      }
      if (filteredPositions.length === 0) {
        return 'Đơn vị trực thuộc này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.';
      }
    }
    return '';
  };

  async function onSubmit(values: AccountCreateValues) {
    try {
      setLoading(true);

      // Loại bỏ confirmPassword trước khi gửi lên server
      const { confirmPassword, ...submitData } = values;

      const response = await apiClient.createAccount(submitData);

      if (response.success) {
        message.success('Tạo tài khoản thành công');
        // Redirect về đúng trang dựa trên role hiện tại
        if (currentUserRole === ROLES.SUPER_ADMIN) {
          router.push('/super-admin/accounts');
        } else if (currentRole === ROLES.ADMIN) {
          router.push('/admin/accounts');
        } else {
          router.push('/super-admin/accounts'); // Fallback
        }
      } else {
        // Hiển thị lỗi từ backend
        // Error handled by UI message below
        message.error(response.message || 'Có lỗi xảy ra khi tạo tài khoản');
      }
    } catch (error: unknown) {
      // Hiển thị lỗi nếu có exception
      const errorMessage =
        getApiErrorMessage(error, 'Có lỗi xảy ra khi tạo tài khoản');

      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Account Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Thông tin tài khoản</h3>

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vai trò *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getAvailableRoles().map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên đăng nhập *</FormLabel>
                <FormControl>
                  <Input placeholder="Nhập tên đăng nhập" {...field} disabled={loading} />
                </FormControl>
                {(selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER) && (
                  <p className="text-sm text-muted-foreground">
                    Khuyến nghị: Sử dụng số CCCD của quân nhân làm tên đăng nhập
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập mật khẩu"
                      {...field}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                {(selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER) && (
                  <p className="text-sm text-muted-foreground">
                    Mật khẩu tạm thời này sẽ được yêu cầu thay đổi khi đăng nhập lần đầu
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Xác nhận mật khẩu *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Nhập lại mật khẩu"
                      {...field}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Unit and Position - For MANAGER and USER */}
        {(selectedRole === ROLES.MANAGER || selectedRole === ROLES.USER) && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Thông tin đơn vị và chức vụ</h3>

            {/* Cơ quan đơn vị - Cho cả MANAGER và USER */}
            <FormField
              control={form.control}
              name="co_quan_don_vi_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cơ quan đơn vị *</FormLabel>
                  <Select
                    onValueChange={value => field.onChange(value)}
                    value={field.value}
                    disabled={loading || coQuanDonViList.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            coQuanDonViList.length === 0
                              ? 'Không có cơ quan đơn vị nào'
                              : 'Chọn cơ quan đơn vị'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {coQuanDonViList.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.ten_don_vi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {coQuanDonViList.length === 0 && (
                    <p className="text-sm text-destructive mt-1">
                      Không có cơ quan đơn vị nào. Vui lòng tạo cơ quan đơn vị trước.
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Đơn vị trực thuộc - Chỉ cho USER */}
            {selectedRole === ROLES.USER && (
              <FormField
                control={form.control}
                name="don_vi_truc_thuoc_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đơn vị trực thuộc *</FormLabel>
                    <Select
                      onValueChange={value => field.onChange(value)}
                      value={field.value}
                      disabled={
                        loading || !selectedCoQuanDonViId || filteredDonViTrucThuoc.length === 0
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedCoQuanDonViId
                                ? 'Vui lòng chọn cơ quan đơn vị trước'
                                : filteredDonViTrucThuoc.length === 0
                                  ? 'Không có đơn vị trực thuộc nào'
                                  : 'Chọn đơn vị trực thuộc'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredDonViTrucThuoc.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.ten_don_vi}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {selectedCoQuanDonViId && filteredDonViTrucThuoc.length === 0 && (
                      <p className="text-sm text-destructive mt-1">
                        Cơ quan đơn vị này chưa có đơn vị trực thuộc. Vui lòng tạo đơn vị trực thuộc
                        trước.
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}

            {/* Chức vụ */}
            <FormField
              control={form.control}
              name="chuc_vu_id"
              render={({ field }) => {
                const canSelectPosition =
                  (selectedRole === ROLES.MANAGER && selectedCoQuanDonViId) ||
                  (selectedRole === ROLES.USER && selectedDonViTrucThuocId);

                return (
                  <FormItem>
                    <FormLabel>Chức vụ</FormLabel>
                    <Select
                      onValueChange={value => field.onChange(value)}
                      value={field.value}
                      disabled={loading || !canSelectPosition || filteredPositions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !canSelectPosition
                                ? selectedRole === ROLES.MANAGER
                                  ? 'Vui lòng chọn cơ quan đơn vị trước'
                                  : 'Vui lòng chọn đơn vị trực thuộc trước'
                                : filteredPositions.length === 0
                                  ? 'Không có chức vụ nào'
                                  : 'Chọn chức vụ'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredPositions.map(position => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.ten_chuc_vu}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {canSelectPosition && filteredPositions.length === 0 && (
                      <p className="text-sm text-destructive mt-1">
                        Đơn vị này chưa có chức vụ nào. Vui lòng tạo chức vụ trước.
                      </p>
                    )}
                  </FormItem>
                );
              }}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="default" onClick={() => router.back()} disabled={loading}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={loading || !canSubmit()}
            title={getSubmitButtonTooltip()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
