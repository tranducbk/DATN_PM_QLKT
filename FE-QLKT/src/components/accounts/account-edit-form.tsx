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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { accountEditSchema } from '@/lib/schemas';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AccountEditValues = z.infer<typeof accountEditSchema>;

interface AccountEditFormProps {
  accountId: string;
}

export function AccountEditForm({ accountId }: AccountEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<AccountEditValues>({
    resolver: zodResolver(accountEditSchema),
    defaultValues: {
      role: 'USER',
    },
  });

  useEffect(() => {
    // Lấy role của user hiện tại
    const role = localStorage.getItem('role');
    setCurrentUserRole(role || '');

    const fetchAccount = async () => {
      try {
        const response = await apiClient.getAccountById(accountId);
        const accountData = response.data || response;
        setAccount(accountData);
        form.reset({
          role: accountData.role,
        });
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Không thể tải thông tin tài khoản';

        toast({
          title: 'Lỗi',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchAccount();
  }, [accountId, toast, form]);

  // Lấy danh sách role có thể chỉnh sửa dựa trên role hiện tại
  const getAvailableRoles = () => {
    if (currentUserRole === 'SUPER_ADMIN') {
      return [
        { value: 'SUPER_ADMIN', label: 'Super Admin' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'USER', label: 'Người dùng' },
      ];
    } else if (currentUserRole === 'ADMIN') {
      // ADMIN chỉ được chỉnh sửa MANAGER và USER
      return [
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'USER', label: 'Người dùng' },
      ];
    }
    // Mặc định chỉ có USER
    return [{ value: 'USER', label: 'Người dùng' }];
  };

  async function onSubmit(values: AccountEditValues) {
    try {
      setLoading(true);
      const response = await apiClient.updateAccount(accountId, values);

      if (response.success) {
        toast({
          title: 'Thành công',
          description: 'Cập nhật tài khoản thành công',
        });
        router.push('/accounts');
      } else {
        toast({
          title: 'Lỗi',
          description: response.message || 'Có lỗi xảy ra khi cập nhật tài khoản',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Có lỗi xảy ra khi cập nhật tài khoản';

      toast({
        title: 'Lỗi',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    try {
      setResetPasswordLoading(true);
      const response = await apiClient.resetPassword({ account_id: parseInt(accountId) });

      if (response.success) {
        toast({
          title: 'Thành công',
          description: 'Đặt lại mật khẩu thành công',
        });
      } else {
        toast({
          title: 'Lỗi',
          description: response.message || 'Có lỗi xảy ra khi đặt lại mật khẩu',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Có lỗi xảy ra khi đặt lại mật khẩu';

      toast({
        title: 'Lỗi',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setResetPasswordLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Không tìm thấy tài khoản</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài khoản</CardTitle>
          <CardDescription>Cập nhật thông tin vai trò của tài khoản</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormItem>
                <FormLabel>Tên đăng nhập</FormLabel>
                <Input value={account.username} disabled className="bg-muted" />
              </FormItem>

              <FormItem>
                <FormLabel>Họ tên Quân nhân</FormLabel>
                <Input value={account.personnel?.ho_ten || ''} disabled className="bg-muted" />
              </FormItem>

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

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Quay lại
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Đang xử lý...' : 'Cập nhật'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Bảo mật</CardTitle>
          <CardDescription>Quản lý bảo mật tài khoản</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Đặt lại mật khẩu sẽ gửi mật khẩu tạm thời cho người dùng qua email.
          </p>
          <Button
            variant="destructive"
            onClick={handleResetPassword}
            disabled={resetPasswordLoading}
          >
            {resetPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resetPasswordLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
