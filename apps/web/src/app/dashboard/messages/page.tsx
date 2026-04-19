'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface MessageLog {
  id: string;
  customerId: number | null;
  phone: string;
  channel: 'ZNS' | 'SMS' | 'ZALO_OA';
  templateCode: string | null;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RETRYING' | 'FALLBACK';
  providerName: string | null;
  errorMessage: string | null;
  attempts: number;
  queuedAt: string;
  sentAt: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; totalPages: number };
}

const STATUS_VARIANT: Record<
  MessageLog['status'],
  'default' | 'success' | 'destructive' | 'warning' | 'outline'
> = {
  QUEUED: 'outline',
  SENDING: 'warning',
  SENT: 'success',
  FAILED: 'destructive',
  RETRYING: 'warning',
  FALLBACK: 'default',
};

export default function MessagesPage() {
  const [status, setStatus] = useState<MessageLog['status'] | ''>('');
  const [channel, setChannel] = useState<MessageLog['channel'] | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', { status, channel, page }],
    queryFn: () =>
      getApiClient()
        .get<Paginated<MessageLog>>('/messages', {
          params: {
            status: status || undefined,
            channel: channel || undefined,
            page,
            pageSize: 20,
          },
        })
        .then((r) => r.data),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tin nhắn đã gửi</h1>
        <div className="text-sm text-muted-foreground">Tổng {data?.meta.total ?? 0}</div>
      </div>

      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MessageLog['status'] | '');
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.keys(STATUS_VARIANT).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as MessageLog['channel'] | '');
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả kênh</option>
          <option value="ZNS">ZNS</option>
          <option value="SMS">SMS</option>
          <option value="ZALO_OA">ZALO_OA</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SĐT</TableHead>
              <TableHead>Kênh</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Queued</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Lỗi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              data?.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.channel}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{m.templateCode ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                  </TableCell>
                  <TableCell>{m.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(m.queuedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(m.sentAt)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-red-600">
                    {m.errorMessage ?? ''}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <span className="text-sm">{page} / {data.meta.totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
