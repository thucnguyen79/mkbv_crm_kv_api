'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

export interface VariantGroupFormData {
  id?: number;
  code: string;
  name: string;
  description?: string;
}

export function VariantGroupFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: VariantGroupFormData | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<VariantGroupFormData>({
    defaultValues: initial ?? { code: '', name: '', description: '' },
  });

  useEffect(() => {
    if (open) reset(initial ?? { code: '', name: '', description: '' });
  }, [open, initial, reset]);

  const mutation = useMutation({
    mutationFn: async (data: VariantGroupFormData) => {
      const api = getApiClient();
      const payload = {
        code: data.code,
        name: data.name,
        description: data.description || undefined,
      };
      return isEdit
        ? api.patch(`/variant-groups/${initial!.id}`, payload)
        : api.post('/variant-groups', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo nhóm biến thể');
      qc.invalidateQueries({ queryKey: ['variant-groups'] });
      qc.invalidateQueries({ queryKey: ['variant-group'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa nhóm biến thể' : 'Tạo nhóm biến thể'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="code">Code (slug)</Label>
            <Input
              id="code"
              placeholder="rayban-aviator-classic"
              {...register('code', { required: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Tên</Label>
            <Input
              id="name"
              placeholder="Rayban Aviator Classic"
              {...register('name', { required: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
          <DialogFooter>
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
