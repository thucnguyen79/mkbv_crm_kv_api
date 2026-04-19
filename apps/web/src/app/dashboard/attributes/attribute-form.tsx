'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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

export interface AttributeFormData {
  id?: number;
  code: string;
  label: string;
  kind: 'STRING' | 'ENUM' | 'NUMBER' | 'BOOLEAN';
  optionsJson?: string;
  isActive: boolean;
}

export function AttributeFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: AttributeFormData | null;
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
    formState: { isSubmitting },
  } = useForm<AttributeFormData>({
    defaultValues:
      initial ?? { code: '', label: '', kind: 'STRING', optionsJson: '', isActive: true },
  });

  useEffect(() => {
    if (open) {
      reset(
        initial ?? { code: '', label: '', kind: 'STRING', optionsJson: '', isActive: true },
      );
    }
  }, [open, initial, reset]);

  const kind = watch('kind');

  const mutation = useMutation({
    mutationFn: async (data: AttributeFormData) => {
      let options: unknown = undefined;
      if (data.kind === 'ENUM' && data.optionsJson) {
        try {
          options = JSON.parse(data.optionsJson);
        } catch (err) {
          throw new Error(`Options JSON invalid: ${(err as Error).message}`);
        }
      }
      const payload = {
        code: data.code,
        label: data.label,
        kind: data.kind,
        options,
        isActive: data.isActive,
      };
      const api = getApiClient();
      return isEdit
        ? api.patch(`/attribute-definitions/${initial!.id}`, payload)
        : api.post('/attribute-definitions', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo');
      qc.invalidateQueries({ queryKey: ['attribute-definitions'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa thuộc tính' : 'Tạo thuộc tính'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="code">Code</Label>
              <Input id="code" placeholder="color" {...register('code', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="label">Label hiển thị</Label>
              <Input id="label" placeholder="Màu sắc" {...register('label', { required: true })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="kind">Kiểu</Label>
            <select
              id="kind"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('kind')}
            >
              <option value="STRING">STRING</option>
              <option value="ENUM">ENUM</option>
              <option value="NUMBER">NUMBER</option>
              <option value="BOOLEAN">BOOLEAN</option>
            </select>
          </div>
          {kind === 'ENUM' && (
            <div className="space-y-1">
              <Label htmlFor="optionsJson">
                Options JSON, VD: <code>[{'{'}"value":"brown","label":"Nâu"{'}'}]</code>
              </Label>
              <Textarea
                id="optionsJson"
                rows={4}
                className="font-mono text-xs"
                {...register('optionsJson')}
              />
            </div>
          )}
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
              {isEdit ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
