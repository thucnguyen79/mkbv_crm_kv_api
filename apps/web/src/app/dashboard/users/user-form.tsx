'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Tối thiểu 8 ký tự'),
  fullName: z.string().min(1),
  roleId: z.number().int().positive(),
  branchId: z.number().int().optional().nullable(),
  isActive: z.boolean(),
});
const editSchema = createSchema.partial({ password: true }).extend({
  email: z.string().email(),
  fullName: z.string().min(1),
});

export interface UserFormData {
  id?: number;
  email: string;
  password?: string;
  fullName: string;
  roleId: number;
  branchId?: number | null;
  isActive: boolean;
}

interface Role {
  id: number;
  code: string;
  name: string;
}

export function UserFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: UserFormData | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const schema = isEdit ? editSchema : createSchema;

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getApiClient().get<Role[]>('/roles').then((r) => r.data),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    // eslint-disable-next-line
    resolver: zodResolver(schema as never),
    defaultValues:
      initial ?? {
        email: '',
        password: '',
        fullName: '',
        roleId: 0,
        branchId: null,
        isActive: true,
      },
  });

  useEffect(() => {
    if (open) {
      reset(
        initial ?? {
          email: '',
          password: '',
          fullName: '',
          roleId: 0,
          branchId: null,
          isActive: true,
        },
      );
    }
  }, [open, initial, reset]);

  const mutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const api = getApiClient();
      const body = {
        email: data.email,
        fullName: data.fullName,
        roleId: Number(data.roleId),
        branchId: data.branchId ? Number(data.branchId) : undefined,
        isActive: data.isActive,
        ...(data.password ? { password: data.password } : {}),
      };
      return isEdit
        ? api.patch(`/users/${initial!.id}`, body)
        : api.post('/users', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật user' : 'Đã tạo user');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa user' : 'Tạo user mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register('fullName')} />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label htmlFor="password">Password (≥ 8 ký tự)</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Password sẽ hiển thị 1 lần sau khi tạo — gửi user qua kênh an toàn.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="roleId">Role</Label>
            <select
              id="roleId"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('roleId', { valueAsNumber: true })}
            >
              <option value={0}>— chọn role —</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="branchId">Chi nhánh (tuỳ chọn)</Label>
            <Input
              id="branchId"
              type="number"
              placeholder="Branch ID"
              {...register('branchId', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={watch('isActive')}
              onCheckedChange={(v) => setValue('isActive', v)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? 'Cập nhật' : 'Tạo user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
