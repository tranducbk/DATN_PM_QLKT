'use client';

import { useState, useEffect } from 'react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { accountFormSchema } from '@/lib/schemas';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  account?: any;
  personnel?: any[];
  onSuccess?: () => void;
  onClose?: () => void;
}

export function AccountForm({ account, personnel = [], onSuccess, onClose }: AccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Lấy role của user hiện tại từ localStorage
    const role = localStorage.getItem('role');
    setCurrentUserRole(role || '');
  }, []);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      username: account?.username || '',
      password: '',
      role: account?.role || 'USER',
      personnel_id: account?.personnel_id || '',
    },
  });

  // Lấy danh sách role có thể tạo/chỉnh sửa dựa trên role hiện tại
  const getAvailableRoles = () => {
    if (currentUserRole === 'SUPER_ADMIN') {
      return [
        { value: 'SUPER_ADMIN', label: 'Super Admin' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'USER', label: 'Người dùng' },
      ];
    } else if (currentUserRole === 'ADMIN') {
      // ADMIN chỉ được tạo/chỉnh sửa MANAGER và USER
      return [
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'USER', label: 'Người dùng' },
      ];
    }
    // Mặc định chỉ có USER
    return [{ value: 'USER', label: 'Người dùng' }];
  };

  async function onSubmit(values: AccountFormValues) {
    try {
      setLoading(true);
      if (account?.id) {
        await apiClient.updateAccount(account.id, values);
        toast({
          title: 'Thành công',
          description: 'Cập nhật tài khoản thành công',
        });
      } else {
        await apiClient.createAccount(values);
        toast({
          title: 'Thành công',
          description: 'Tạo tài khoản thành công',
        });
      }
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Có lỗi xảy ra',
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
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên đăng nhập</FormLabel>
              <FormControl>
                <Input placeholder="Nhập tên đăng nhập" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!account && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Nhập mật khẩu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="personnel_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Quân nhân</FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value
                        ? personnel.find(p => p.id === field.value)?.ho_ten
                        : 'Chọn quân nhân...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Tìm kiếm quân nhân..." />
                    <CommandEmpty>Không tìm thấy quân nhân</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {personnel.map(p => (
                          <CommandItem
                            value={p.id}
                            key={p.id}
                            onSelect={() => {
                              form.setValue('personnel_id', p.id);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                field.value === p.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {p.ho_ten}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vai trò</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : account ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
