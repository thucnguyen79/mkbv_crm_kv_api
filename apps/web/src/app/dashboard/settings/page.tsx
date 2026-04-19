'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, RefreshCw, Save, Zap, Webhook, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

interface SettingRow {
  key: string;
  value: string;
  masked: boolean;
  updatedAt: string | null;
  source: 'db' | 'env' | 'none';
}

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
}

const SECTIONS: Array<{
  title: string;
  description: string;
  fields: Field[];
  testBtn: { label: string; action: 'kv-api' | 'kv-webhook' | 'sms' | 'zns' | 'zoa' };
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    title: 'KiotViet API',
    description: 'OAuth2 client credentials — dùng cho sync data.',
    icon: Zap,
    testBtn: { label: 'Test API', action: 'kv-api' },
    fields: [
      { key: 'kiotviet.retailer', label: 'Retailer', placeholder: 'mkbv (subdomain)' },
      { key: 'kiotviet.clientId', label: 'Client ID' },
      { key: 'kiotviet.clientSecret', label: 'Client Secret' },
      { key: 'kiotviet.baseUrl', label: 'Base URL' },
      { key: 'kiotviet.tokenUrl', label: 'Token URL' },
      { key: 'kiotviet.scope', label: 'Scope' },
    ],
  },
  {
    title: 'KiotViet Webhook',
    description: 'HMAC secret để KV push event realtime về CRM.',
    icon: Webhook,
    testBtn: { label: 'Test Webhook', action: 'kv-webhook' },
    fields: [
      {
        key: 'kiotviet.webhookSecret',
        label: 'Webhook Secret',
        help: 'Phải giống giá trị đã đăng ký trong KV → Cài đặt → Webhook',
      },
    ],
  },
  {
    title: 'SMS Provider',
    description: 'Dùng cho fallback khi ZNS fail, hoặc gửi SMS campaign.',
    icon: MessageSquare,
    testBtn: { label: 'Gửi SMS test', action: 'sms' },
    fields: [
      {
        key: 'sms.provider',
        label: 'Provider',
        placeholder: 'stub | esms | stringee | incom',
        help: 'stub = log-only (dev). Đổi sang ESMS/Stringee/Incom khi production.',
      },
      { key: 'sms.apiKey', label: 'API Key' },
      { key: 'sms.apiSecret', label: 'API Secret' },
      {
        key: 'sms.senderName',
        label: 'Brand name / Sender ID',
        placeholder: 'MKBV',
        help: 'Phải được provider duyệt trước khi dùng',
      },
    ],
  },
  {
    title: 'ZNS Provider (Zalo Notification Service)',
    description: 'Gửi tin template đã duyệt qua Zalo OA. 200-600đ/tin.',
    icon: Send,
    testBtn: { label: 'Gửi ZNS test', action: 'zns' },
    fields: [
      {
        key: 'zns.provider',
        label: 'Provider',
        placeholder: 'stub | esms | zalo-direct',
      },
      { key: 'zns.apiKey', label: 'API Key' },
      { key: 'zns.apiSecret', label: 'API Secret' },
      { key: 'zns.oaId', label: 'OA ID', help: 'Official Account ID' },
    ],
  },
  {
    title: 'Zalo OA Provider (Tin chăm sóc 2 chiều)',
    description:
      'Chat trong cửa sổ 48h sau lần tương tác cuối của user. Provider stub báo NotImplemented.',
    icon: MessageSquare,
    testBtn: { label: 'Gửi OA test', action: 'zoa' },
    fields: [
      {
        key: 'zalo_oa.provider',
        label: 'Provider',
        placeholder: 'stub | zalo-direct',
      },
      { key: 'zalo_oa.accessToken', label: 'Access Token (long-lived)' },
      { key: 'zalo_oa.refreshToken', label: 'Refresh Token' },
      { key: 'zalo_oa.oaId', label: 'OA ID' },
      { key: 'zalo_oa.appId', label: 'App ID' },
    ],
  },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [testChannel, setTestChannel] = useState<'sms' | 'zns' | 'zoa' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      getApiClient()
        .get<SettingRow[]>('/settings')
        .then((r) => r.data),
  });

  const testKvApi = useMutation({
    mutationFn: () =>
      getApiClient()
        .post<{
          ok: boolean;
          error?: string;
          tokenTtl?: number;
          retailerBranchCount?: number;
        }>('/settings/kiotviet/test-api')
        .then((r) => r.data),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          `KiotViet API OK · TTL ${res.tokenTtl}s · ${res.retailerBranchCount} chi nhánh`,
        );
      } else {
        toast.error(`Fail: ${res.error}`);
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const testKvWebhook = useMutation({
    mutationFn: () =>
      getApiClient()
        .post<{ ok: boolean; httpStatus?: number; hint?: string; error?: string }>(
          '/settings/kiotviet/test-webhook',
        )
        .then((r) => r.data),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Webhook OK · HTTP ${res.httpStatus} · ${res.hint}`);
      } else {
        toast.error(`${res.hint ?? ''} · ${res.error}`);
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const onTest = (action: 'kv-api' | 'kv-webhook' | 'sms' | 'zns' | 'zoa') => {
    if (action === 'kv-api') return testKvApi.mutate();
    if (action === 'kv-webhook') return testKvWebhook.mutate();
    setTestChannel(action);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cấu hình hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Thay đổi áp dụng ngay, không cần restart. Secret được mã hóa AES-256-GCM.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <Card key={sec.title}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <CardTitle>{sec.title}</CardTitle>
                </div>
                <CardDescription>{sec.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sec.fields.map((f) => (
                  <SettingField
                    key={f.key}
                    field={f}
                    row={data?.find((r) => r.key === f.key)}
                    onSaved={() => qc.invalidateQueries({ queryKey: ['settings'] })}
                  />
                ))}
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-1">db</Badge> đã lưu ·
                    <Badge variant="outline" className="mx-1">env</Badge> fallback .env ·
                    <Badge variant="outline" className="ml-1">none</Badge> chưa có
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onTest(sec.testBtn.action)}
                    disabled={testKvApi.isPending || testKvWebhook.isPending}
                  >
                    <Zap className="mr-1 h-3 w-3" />
                    {sec.testBtn.label}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <TestMessageDialog
        channel={testChannel}
        onClose={() => setTestChannel(null)}
      />
    </div>
  );
}

function SettingField({
  field,
  row,
  onSaved,
}: {
  field: Field;
  row?: SettingRow;
  onSaved: () => void;
}) {
  const isMasked = row?.masked ?? false;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);

  const save = useMutation({
    mutationFn: () => getApiClient().post(`/settings/${encodeURIComponent(field.key)}`, { value }),
    onSuccess: () => {
      toast.success(`Đã lưu ${field.label}`);
      setEditing(false);
      setValue('');
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-2 border-b pb-3 last:border-b-0">
      <div className="space-y-1">
        <Label className="flex items-center gap-2">
          {field.label}
          {row?.source && (
            <Badge variant={row.source === 'db' ? 'secondary' : 'outline'} className="text-xs">
              {row.source}
            </Badge>
          )}
          {row?.updatedAt && (
            <span className="text-xs text-muted-foreground">
              cập nhật {formatDateTime(row.updatedAt)}
            </span>
          )}
        </Label>
        {editing ? (
          <Input
            type={isMasked && !reveal ? 'password' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder}
            autoFocus
          />
        ) : (
          <div className="flex min-h-9 items-center rounded-md border border-dashed border-transparent bg-muted/40 px-3 text-sm font-mono">
            {row?.value || <span className="italic text-muted-foreground">(chưa đặt)</span>}
          </div>
        )}
        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      </div>

      <div className="flex gap-1 pt-6">
        {editing ? (
          <>
            {isMasked && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setReveal((r) => !r)}
                title={reveal ? 'Ẩn' : 'Hiện'}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !value}
            >
              <Save className="mr-1 h-3 w-3" />
              Lưu
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue('');
              }}
            >
              Huỷ
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true);
              setValue('');
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Sửa
          </Button>
        )}
      </div>
    </div>
  );
}

function TestMessageDialog({
  channel,
  onClose,
}: {
  channel: 'sms' | 'zns' | 'zoa' | null;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [zaloUserId, setZaloUserId] = useState('');

  const send = useMutation({
    mutationFn: () => {
      const endpoint =
        channel === 'sms'
          ? '/settings/sms/test'
          : channel === 'zns'
            ? '/settings/zns/test'
            : '/settings/zalo-oa/test';
      return getApiClient()
        .post<{
          ok: boolean;
          providerName?: string;
          providerId?: string;
          error?: string;
          message?: string;
        }>(endpoint, {
          phone,
          body: body || undefined,
          zaloUserId: zaloUserId || undefined,
        })
        .then((r) => r.data);
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          `${res.providerName ?? 'stub'} · id=${res.providerId} · ${res.message ?? ''}`,
        );
        onClose();
      } else {
        toast.error(`Fail: ${res.error}`);
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const label = channel === 'sms' ? 'SMS' : channel === 'zns' ? 'ZNS' : 'Zalo OA';

  return (
    <Dialog open={channel !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi {label} test</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="phone">Số điện thoại nhận</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
            />
          </div>
          {channel === 'zoa' && (
            <div className="space-y-1">
              <Label htmlFor="zaloUserId">Zalo User ID (cho OA)</Label>
              <Input
                id="zaloUserId"
                value={zaloUserId}
                onChange={(e) => setZaloUserId(e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="body">Nội dung (optional — default là chuỗi test)</Label>
            <Input
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`[TEST ${label}] ...`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending || !phone}>
            <Send className="mr-1 h-4 w-4" />
            Gửi test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
