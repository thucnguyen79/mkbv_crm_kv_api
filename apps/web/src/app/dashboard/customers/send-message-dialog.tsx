'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

interface Template {
  id: number;
  code: string;
  channel: string;
  name: string;
  placeholders: string[];
}

export function SendMessageDialog({
  customerId,
  customerName,
  onClose,
}: {
  customerId: number | null;
  customerName: string;
  onClose: () => void;
}) {
  const [templateCode, setTemplateCode] = useState('');
  const [variablesJson, setVariablesJson] = useState('{}');
  const [allowFallback, setAllowFallback] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getApiClient().get<Template[]>('/templates').then((r) => r.data),
    enabled: customerId !== null,
  });

  const selected = templates?.find((t) => t.code === templateCode);

  const send = useMutation({
    mutationFn: async () => {
      let vars: Record<string, unknown>;
      try {
        vars = JSON.parse(variablesJson);
      } catch (err) {
        throw new Error(`Variables JSON invalid: ${(err as Error).message}`);
      }
      return getApiClient().post('/messages/send', {
        customerIds: [customerId],
        templateCode,
        variables: vars,
        allowFallback,
      });
    },
    onSuccess: (res) => {
      const body = res.data as { enqueued: string[]; skipped: string[] };
      toast.success(
        `Đã queue ${body.enqueued.length} tin${
          body.skipped.length ? `, skip ${body.skipped.length}` : ''
        }`,
      );
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={customerId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi tin cho {customerName}</DialogTitle>
          <DialogDescription>
            Chọn template + nhập biến JSON. Tin được queue ngay, check status ở trang Tin nhắn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="templateCode">Template</Label>
            <select
              id="templateCode"
              value={templateCode}
              onChange={(e) => {
                setTemplateCode(e.target.value);
                const t = templates?.find((x) => x.code === e.target.value);
                if (t) {
                  const example = Object.fromEntries(t.placeholders.map((p) => [p, '']));
                  setVariablesJson(JSON.stringify(example, null, 2));
                }
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— chọn template —</option>
              {templates?.filter((t) => t.channel !== 'ZALO_OA').map((t) => (
                <option key={t.id} value={t.code}>
                  [{t.channel}] {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="space-y-1">
              <Label htmlFor="variables">
                Biến (placeholder: {selected.placeholders.join(', ') || '—'})
              </Label>
              <Textarea
                id="variables"
                rows={5}
                className="font-mono text-xs"
                value={variablesJson}
                onChange={(e) => setVariablesJson(e.target.value)}
              />
            </div>
          )}

          {selected?.channel === 'ZNS' && (
            <div className="flex items-center gap-2">
              <Switch
                id="fallback"
                checked={allowFallback}
                onCheckedChange={setAllowFallback}
              />
              <Label htmlFor="fallback">Allow fallback ZNS → SMS khi fail</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={() => send.mutate()}
            disabled={!templateCode || send.isPending}
          >
            <Send className="mr-1 h-4 w-4" />
            Gửi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
