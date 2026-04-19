'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  RefreshCw,
  Play,
  RotateCcw,
  Loader2,
  Clock,
  Hourglass,
  MoreVertical,
  Eraser,
  Ban,
  XCircle,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
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
import { apiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

type QueueState = 'active' | 'waiting' | 'delayed' | null;

interface SyncCursor {
  entity: string;
  status: string | null;
  queueState: QueueState;
  lastRunAt: string | null;
  lastSyncedAt: string | null;
  note: string | null;
  checkpointOffset: number;
  hasCheckpoint: boolean;
}

interface SyncStatusResponse {
  data: SyncCursor[];
  meta: { entities: string[]; paused: boolean };
}

export default function SyncStatusPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['sync-status-full'],
    queryFn: () =>
      getApiClient().get<SyncStatusResponse>('/sync/status').then((r) => r.data),
    refetchInterval: 5_000, // 5s khi có job đang chạy — response đổi nhanh
  });

  const paused = data?.meta.paused ?? false;

  const runOne = useMutation({
    mutationFn: (entity: string) => getApiClient().post(`/sync/${entity}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-status-full'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const runAll = useMutation({
    mutationFn: () => getApiClient().post('/sync/pipeline/run'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-status-full'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggleQueue = useMutation({
    mutationFn: (wantPaused: boolean) =>
      getApiClient()
        .post<{ ok: boolean; paused: boolean }>(wantPaused ? '/sync/pause' : '/sync/resume')
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(
        res.paused
          ? 'Queue OFF — cron không chạy, job hiện tại vẫn tiếp tục tới xong'
          : 'Queue ON — cron + manual hoạt động',
      );
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const resetCheckpoint = useMutation({
    mutationFn: (entity: string) => getApiClient().post(`/sync/${entity}/reset-checkpoint`),
    onSuccess: (_r, entity) => {
      toast.success(`Đã xoá checkpoint ${entity}`);
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const resetCursor = useMutation({
    mutationFn: (entity: string) => getApiClient().post(`/sync/${entity}/reset-cursor`),
    onSuccess: (_r, entity) => {
      toast.success(`Đã reset cursor ${entity} — lần sau pull full từ đầu`);
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const cancelAll = useMutation({
    mutationFn: () =>
      getApiClient()
        .post<{ removed: number; aborted: number }>('/sync/cancel-all')
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(`Đã huỷ · ${res.aborted} đang chạy + ${res.removed} chờ`);
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const resetAllCursors = useMutation({
    mutationFn: () =>
      getApiClient()
        .post<{ reset: string[] }>('/sync/reset-all-cursors')
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(
        `Đã reset ${res.reset.length} entity — chạy pipeline để pull full từ KiotViet`,
      );
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const cancelEntity = useMutation({
    mutationFn: (entity: string) =>
      getApiClient()
        .post<{ aborted: boolean; removed: number }>(`/sync/${entity}/cancel`)
        .then((r) => r.data),
    onSuccess: (res, entity) => {
      toast.success(
        `Đã huỷ ${entity} · ${res.aborted ? 'abort đang chạy' : `xoá ${res.removed} chờ`}`,
      );
      qc.invalidateQueries({ queryKey: ['sync-status-full'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const rows = data?.data ?? [];
  const activeCount = rows.filter((c) => c.queueState === 'active').length;
  const waitingCount = rows.filter((c) => c.queueState === 'waiting').length;
  const delayedCount = rows.filter((c) => c.queueState === 'delayed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Sync KiotViet</h1>
          {paused && <Badge variant="destructive">Queue OFF</Badge>}
          {activeCount > 0 && (
            <Badge variant="warning" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {activeCount} đang sync
            </Badge>
          )}
          {waitingCount > 0 && (
            <Badge variant="secondary">
              <Hourglass className="mr-1 h-3 w-3" />
              {waitingCount} chờ
            </Badge>
          )}
          {delayedCount > 0 && (
            <Badge variant="secondary">
              <Clock className="mr-1 h-3 w-3" />
              {delayedCount} retry
            </Badge>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <Switch
                id="queue-toggle"
                checked={!paused}
                disabled={toggleQueue.isPending}
                onCheckedChange={(on) => toggleQueue.mutate(!on)}
              />
              <Label htmlFor="queue-toggle" className="cursor-pointer select-none text-sm">
                Queue {paused ? 'OFF' : 'ON'}
              </Label>
            </div>
            {(activeCount + waitingCount + delayedCount) > 0 && (
              <Button
                onClick={() => {
                  if (
                    confirm(
                      'Huỷ tất cả job (abort running + xoá waiting)? Queue state không đổi.',
                    )
                  ) {
                    cancelAll.mutate();
                  }
                }}
                disabled={cancelAll.isPending}
                variant="outline"
              >
                <Ban className="mr-1 h-4 w-4" />
                Huỷ tất cả
              </Button>
            )}
            <Button onClick={() => runAll.mutate()} disabled={runAll.isPending || paused}>
              <Play className="mr-1 h-4 w-4" />
              Chạy toàn bộ pipeline
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Rebuild full từ KiotViet</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={resetAllCursors.isPending || activeCount + waitingCount > 0}
                  onClick={() => {
                    if (
                      confirm(
                        'Reset TOÀN BỘ cursor? Lần chạy pipeline kế tiếp sẽ pull FULL data từ KiotViet cho 7 entity (có thể mất 10-30 phút với dataset lớn).\n\nDữ liệu CRM-native (tags, attributes, templates, campaigns, message logs, user, notifications, ảnh SP) ĐƯỢC GIỮ NGUYÊN — chỉ các field từ KiotViet được update lại.',
                      )
                    ) {
                      resetAllCursors.mutate();
                    }
                  }}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Reset tất cả cursor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {paused && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          Queue đang <strong>OFF</strong>. Cron 5 phút bỏ qua, manual "Chạy pipeline" bị khoá.
          Job đang chạy vẫn chạy tới khi xong. Bật công tắc <strong>Queue</strong> ở trên để tiếp
          tục.
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Checkpoint</TableHead>
              <TableHead>Lần chạy gần nhất</TableHead>
              <TableHead>Sync gần nhất</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              rows.map((c) => (
                <TableRow key={c.entity}>
                  <TableCell className="font-mono">{c.entity}</TableCell>
                  <TableCell>
                    <StatusBadge cursor={c} />
                  </TableCell>
                  <TableCell>
                    <CheckpointBadge cursor={c} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(c.lastRunAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(c.lastSyncedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.note ?? '—'}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runOne.mutate(c.entity)}
                          disabled={
                            runOne.isPending ||
                            paused ||
                            c.queueState === 'active' ||
                            c.queueState === 'waiting'
                          }
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          {c.hasCheckpoint && c.status !== 'success' && c.status !== 'running'
                            ? 'Resume'
                            : 'Chạy lại'}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" title="More">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>Huỷ job</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={
                                !c.queueState ||
                                cancelEntity.isPending
                              }
                              onClick={() => {
                                if (
                                  confirm(
                                    `Huỷ job ${c.entity}? ${
                                      c.queueState === 'active'
                                        ? 'Abort ở checkpoint gần nhất.'
                                        : 'Xoá khỏi queue.'
                                    }`,
                                  )
                                ) {
                                  cancelEntity.mutate(c.entity);
                                }
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Huỷ job này
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Reset</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={!c.hasCheckpoint || c.status === 'running'}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Xoá checkpoint ${c.entity}? Lần sync kế tiếp chạy fresh từ lastSyncedAt (không resume từ offset dở dang).`,
                                  )
                                ) {
                                  resetCheckpoint.mutate(c.entity);
                                }
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reset checkpoint
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={c.status === 'running'}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Reset full cho ${c.entity}? Cả lastSyncedAt sẽ bị xoá — lần sync kế tiếp sẽ pull TOÀN BỘ data từ KiotViet (dataset lớn có thể mất nhiều phút). Dùng khi cần fix FK link bị sai do chạy sai thứ tự.`,
                                  )
                                ) {
                                  resetCursor.mutate(c.entity);
                                }
                              }}
                            >
                              <Eraser className="mr-2 h-4 w-4" />
                              Reset full (clear lastSyncedAt)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Hiển thị status thực tế:
 *  queueState=active  → "Đang sync" + spinner
 *  queueState=waiting → "Chờ"
 *  queueState=delayed → "Retry"
 *  không có queue → show cursor.status (success/failed/cancelled)
 */
function StatusBadge({ cursor }: { cursor: SyncCursor }) {
  if (cursor.queueState === 'active') {
    return (
      <Badge variant="warning" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Đang sync
      </Badge>
    );
  }
  if (cursor.queueState === 'waiting') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Hourglass className="h-3 w-3" />
        Chờ queue
      </Badge>
    );
  }
  if (cursor.queueState === 'delayed') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Retry sau
      </Badge>
    );
  }
  const s = cursor.status;
  if (s === 'success') return <Badge variant="success">success</Badge>;
  if (s === 'failed') return <Badge variant="destructive">failed</Badge>;
  if (s === 'cancelled') return <Badge variant="outline">cancelled</Badge>;
  if (s === 'running')
    // Cursor running nhưng không có job queue — stale (ví dụ crash server).
    return (
      <Badge variant="outline" className="text-muted-foreground">
        stale
      </Badge>
    );
  return <Badge variant="outline">{s ?? '—'}</Badge>;
}

/**
 * Checkpoint badge:
 *  - Trong lúc đang active: hiện progress (nếu offset > 0)
 *  - Sau khi fail/cancel: hiện "resume @ X"
 *  - Fresh run đang chờ (waiting/delayed, offset=0): không hiện
 */
function CheckpointBadge({ cursor }: { cursor: SyncCursor }) {
  if (!cursor.hasCheckpoint) return <span className="text-xs text-muted-foreground">—</span>;
  if (cursor.queueState === 'active' && cursor.checkpointOffset > 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        tiến độ: {cursor.checkpointOffset}
      </Badge>
    );
  }
  if (cursor.status === 'failed' || cursor.status === 'cancelled') {
    return (
      <Badge variant="warning" className="text-xs">
        resume @ {cursor.checkpointOffset}
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
