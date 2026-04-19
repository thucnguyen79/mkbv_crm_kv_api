'use client';

import { useQuery } from '@tanstack/react-query';
import { Webhook, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface WebhookLogEntry {
  at: string;
  id: string;
  attempt: number;
  actions: string[];
  entitiesEnqueued: string[];
  verified: boolean;
  sizeBytes: number;
}

export default function WebhooksPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['webhook-recent'],
    queryFn: () =>
      getApiClient()
        .get<WebhookLogEntry[]>('/webhooks/kiotviet/recent', { params: { limit: 100 } })
        .then((r) => r.data),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Webhook logs</h1>
          <Badge variant="secondary">{data?.length ?? 0} gần nhất</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Ring buffer 100 webhook gần nhất từ KiotViet (TTL 24h, lưu trong Redis). Mỗi khi KV push
        event, 1 entry được ghi. Dùng để debug khi nghi ngờ KV không push hoặc signature sai.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Enqueued</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.length ? (
              data.map((w, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(w.at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{w.id}</TableCell>
                  <TableCell>
                    {w.attempt > 1 ? (
                      <Badge variant="warning">#{w.attempt}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">1</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {w.verified ? (
                      <Badge variant="success" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        HMAC OK
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Không verify
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {w.actions.map((a, j) => (
                        <Badge key={j} variant="outline" className="font-mono text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {w.entitiesEnqueued.length ? (
                        w.entitiesEnqueued.map((e, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">
                            {e}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {(w.sizeBytes / 1024).toFixed(1)} KB
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Chưa có webhook nào. Kiểm tra KV đã đăng ký webhook URL chưa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
