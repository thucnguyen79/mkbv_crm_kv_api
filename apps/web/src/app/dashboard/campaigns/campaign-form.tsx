'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

export interface CampaignFormData {
  id?: number;
  name: string;
  description?: string;
  type: 'ONE_OFF' | 'RECURRING' | 'TRIGGERED';
  ruleCode: string;
  conditionsJson: string; // edit as raw JSON
  templateId: number;
  fallbackTemplateId?: number | null;
  allowFallback: boolean;
  schedule?: string;
  requiresApproval: boolean;
  refreshOnApprove: boolean;
  isActive: boolean;
}

interface Rule {
  code: string;
  description: string;
  conditionsSchema: Record<string, unknown>;
}

interface Template {
  id: number;
  code: string;
  channel: string;
  name: string;
}

export function CampaignFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: CampaignFormData | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;

  const { data: rules } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => getApiClient().get<Rule[]>('/automation/rules').then((r) => r.data),
  });
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getApiClient().get<Template[]>('/templates').then((r) => r.data),
  });

  const defaults: CampaignFormData = useMemo(
    () =>
      initial ?? {
        name: '',
        description: '',
        type: 'ONE_OFF',
        ruleCode: 'INACTIVE',
        conditionsJson: JSON.stringify({ inactiveDays: 30, cooldownDays: 14, limit: 500 }, null, 2),
        templateId: 0,
        fallbackTemplateId: null,
        allowFallback: false,
        schedule: '',
        requiresApproval: true,
        refreshOnApprove: false,
        isActive: true,
      },
    [initial],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<CampaignFormData>({ defaultValues: defaults });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  // Khi đổi ruleCode, autofill conditionsJson từ schema gợi ý
  const ruleCode = watch('ruleCode');
  const selectedRule = rules?.find((r) => r.code === ruleCode);

  const type = watch('type');
  // ONE_OFF + TRIGGERED ép approval theo backend logic
  useEffect(() => {
    if (type === 'TRIGGERED') setValue('requiresApproval', false);
    if (type === 'ONE_OFF') setValue('requiresApproval', true);
  }, [type, setValue]);

  const [jsonError, setJsonError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      let conditions: Record<string, unknown> = {};
      try {
        conditions = data.conditionsJson ? JSON.parse(data.conditionsJson) : {};
      } catch (err) {
        setJsonError(`Conditions JSON invalid: ${(err as Error).message}`);
        throw err;
      }
      setJsonError(null);
      const payload = {
        name: data.name,
        description: data.description || undefined,
        type: data.type,
        ruleCode: data.ruleCode,
        conditions,
        templateId: Number(data.templateId),
        fallbackTemplateId: data.fallbackTemplateId ? Number(data.fallbackTemplateId) : undefined,
        allowFallback: data.allowFallback,
        schedule: data.type === 'RECURRING' ? data.schedule : undefined,
        requiresApproval: data.requiresApproval,
        refreshOnApprove: data.refreshOnApprove,
        isActive: data.isActive,
      };
      const api = getApiClient();
      return isEdit ? api.patch(`/campaigns/${initial!.id}`, payload) : api.post('/campaigns', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Đã cập nhật chiến dịch' : 'Đã tạo chiến dịch');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa chiến dịch' : 'Tạo chiến dịch'}</DialogTitle>
          <DialogDescription>
            ONE_OFF buộc duyệt · TRIGGERED không duyệt · RECURRING tuỳ chọn
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Tên chiến dịch</Label>
              <Input id="name" {...register('name', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type">Loại</Label>
              <select
                id="type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('type')}
              >
                <option value="ONE_OFF">ONE_OFF</option>
                <option value="RECURRING">RECURRING</option>
                <option value="TRIGGERED">TRIGGERED</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea id="description" rows={2} {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ruleCode">Rule</Label>
              <select
                id="ruleCode"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('ruleCode')}
              >
                {rules?.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code}
                  </option>
                ))}
              </select>
              {selectedRule && (
                <p className="text-xs text-muted-foreground">{selectedRule.description}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="templateId">Template</Label>
              <select
                id="templateId"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('templateId', { valueAsNumber: true })}
              >
                <option value={0}>— chọn template —</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.channel}] {t.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="conditionsJson">
              Conditions (JSON — schema: {JSON.stringify(selectedRule?.conditionsSchema ?? {})})
            </Label>
            <Textarea
              id="conditionsJson"
              rows={5}
              className="font-mono text-xs"
              {...register('conditionsJson')}
            />
            {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
          </div>

          {type === 'RECURRING' && (
            <div className="space-y-1">
              <Label htmlFor="schedule">Cron schedule (VD: <code>0 9 * * *</code>)</Label>
              <Input id="schedule" className="font-mono" {...register('schedule')} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fallbackTemplateId">Template fallback (SMS)</Label>
              <select
                id="fallbackTemplateId"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('fallbackTemplateId', { valueAsNumber: true })}
              >
                <option value={0}>— không có —</option>
                {templates?.filter((t) => t.channel === 'SMS').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="allowFallback"
                checked={watch('allowFallback')}
                onCheckedChange={(v) => setValue('allowFallback', v)}
              />
              <Label htmlFor="allowFallback">Allow fallback ZNS → SMS</Label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="requiresApproval"
                checked={watch('requiresApproval')}
                disabled={type !== 'RECURRING'}
                onCheckedChange={(v) => setValue('requiresApproval', v)}
              />
              <Label htmlFor="requiresApproval">Yêu cầu duyệt</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="refreshOnApprove"
                checked={watch('refreshOnApprove')}
                onCheckedChange={(v) => setValue('refreshOnApprove', v)}
              />
              <Label htmlFor="refreshOnApprove">Refresh khi duyệt</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={watch('isActive')}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
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
