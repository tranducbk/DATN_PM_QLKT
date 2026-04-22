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
import type { CreateAccountBody } from '@/lib/api/accounts';
import { apiClient } from '@/lib/apiClient';
import { App } from 'antd';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ROLES, roleSelectOptions } from '@/constants/roles.constants';

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
  const { message } = App.useApp();
  const { user } = useAuth();
  const currentUserRole = user?.role || '';

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      username: account?.username || '',
      password: '',
      role: account?.role || ROLES.USER,
      personnel_id: account?.personnel_id || '',
    },
  });

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

  async function onSubmit(values: AccountFormValues) {
    try {
      setLoading(true);
      if (account?.id) {
        await apiClient.updateAccount(account.id, values);
        message.success('Cập nhật tài khoản thành công');
      } else {
        if (!values.password) {
          message.error('Vui lòng nhập mật khẩu khi tạo tài khoản');
          return;
        }
        const body: CreateAccountBody = {
          username: values.username,
          password: values.password,
          role: values.role,
          personnel_id: values.personnel_id || undefined,
          co_quan_don_vi_id: values.co_quan_don_vi_id,
          don_vi_truc_thuoc_id: values.don_vi_truc_thuoc_id,
          chuc_vu_id: values.chuc_vu_id,
        };
        await apiClient.createAccount(body);
        message.success('Tạo tài khoản thành công');
      }
      onSuccess?.();
      onClose?.();
    } catch (error) {
      message.error('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = loading ? 'Đang xử lý...' : account ? 'Cập nhật' : 'Tạo mới';

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
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
