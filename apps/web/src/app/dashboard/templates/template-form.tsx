'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export interface TemplateFormData {
  id?: number;
  code: string;
  channel: 'ZNS' | 'SMS' | 'ZALO_OA';
  name: string;
  body: string;
  providerTemplateId?: string;
  isActive: boolean;
}

const schema = z.object({
  code: z.string().min(3).max(80),
  channel: z.enum(['ZNS', 'SMS', 'ZALO_OA']),
  name: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  providerTemplateId: z.string().max(120).optional().or(z.literal('')),
  isActive: z.boolean(),
});

export function TemplateFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: TemplateFormData | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {
      code: '',
      channel: 'ZNS',
      name: '',
      body: '',
      providerTemplateId: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        initial ?? {
          code: '',
          channel: 'ZNS',
          name: '',
          body: '',
          providerTemplateId: '',
          isActive: true,
        },
      );
    }
  }, [open, initial, reset]);

  const mutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const payload = {
        code: data.code,
        channel: data.channel,
        name: data.name,
        body: data.body,
        providerTemplateId: data.providerTemplateId || undefined,
        isActive: data.isActive,
      };
      const api = getApiClient();
      return isEdit
        ? api.patch(`/templates/${initial!.id}`, payload)
        : api.post('/templates', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật template' : 'Đã tạo template');
      qc.invalidateQueries({ queryKey: ['templates'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa template' : 'Tạo template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="code">Code</Label>
              <Input id="code" placeholder="ZNS_REACTIVATE_30D" {...register('code')} />
              {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="channel">Kênh</Label>
              <select
                id="channel"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('channel')}
              >
                <option value="ZNS">ZNS</option>
                <option value="SMS">SMS</option>
                <option value="ZALO_OA">ZALO_OA (chưa hỗ trợ)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="name">Tên hiển thị</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="body">Body (dùng {'{{name}}'} để bind biến)</Label>
            <Textarea id="body" rows={4} {...register('body')} />
            {errors.body && <p className="text-xs text-red-600">{errors.body.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="providerTemplateId">
              Provider template ID (Zalo ZNS đã duyệt — optional)
            </Label>
            <Input id="providerTemplateId" {...register('providerTemplateId')} />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={watch('isActive')}
              onCheckedChange={(v) => setValue('isActive', v)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
