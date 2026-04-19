'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X as XIcon, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type RunStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'CANCELLED';

interface CampaignRun {
  id: number;
  campaignId: number;
  campaign: { name: string; type: string };
  status: RunStatus;
  matchedCount: number;
  enqueuedCount: number;
  triggeredById: number | null;
  approvedById: number | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  executedAt: string | null;
  createdAt: string;
}

interface RunDetail extends CampaignRun {
  snapshot: Array<{ customerId: number; phone: string; variables: Record<string, unknown> }>;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; totalPages: number };
}

const STATUS_BADGE: Record<RunStatus, { variant: 'default' | 'warning' | 'success' | 'destructive' | 'secondary' | 'outline'; label: string }> = {
  PENDING_APPROVAL: { variant: 'warning', label: 'Chờ duyệt' },
  APPROVED: { variant: 'secondary', label: 'Đã duyệt' },
  REJECTED: { variant: 'destructive', label: 'Từ chối' },
  EXECUTED: { variant: 'success', label: 'Đã gửi' },
  CANCELLED: { variant: 'outline', label: 'Đã huỷ' },
};

export default function CampaignRunsPage() {
  const [status, setStatus] = useState<RunStatus | ''>('PENDING_APPROVAL');
  const [selectedRun, setSelectedRun] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-runs', { status }],
    queryFn: () =>
      getApiClient()
        .get<Paginated<CampaignRun>>('/campaign-runs', {
          params: { status: status || undefined, pageSize: 50 },
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Duyệt chiến dịch</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RunStatus | '')}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả</option>
          {Object.entries(STATUS_BADGE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Chiến dịch</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Match</TableHead>
              <TableHead className="text-right">Đã gửi</TableHead>
              <TableHead>Tạo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data.length ? (
              data.data.map((r) => {
                const s = STATUS_BADGE[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.campaign.name}</div>
                      <div className="text-xs text-muted-foreground">{r.campaign.type}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.matchedCount}</TableCell>
                    <TableCell className="text-right">{r.enqueuedCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRun(r.id)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Không có run nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <RunDetailDialog runId={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}

function RunDetailDialog({
  runId,
  onClose,
}: {
  runId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-run', runId],
    queryFn: () =>
      getApiClient()
        .get<RunDetail>(`/campaign-runs/${runId}`)
        .then((r) => r.data),
    enabled: runId !== null,
  });

  const approve = useMutation({
    mutationFn: () => getApiClient().post(`/campaign-runs/${runId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-runs'] });
      onClose();
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      getApiClient().post(`/campaign-runs/${runId}/reject`, { reason: rejectReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-runs'] });
      setRejectReason('');
      onClose();
    },
  });

  const canDecide = data?.status === 'PENDING_APPROVAL';
  const snapshot = data?.snapshot ?? [];

  return (
    <Dialog open={runId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campaign Run #{runId}</DialogTitle>
          <DialogDescription>
            {data?.campaign.name} · {data && STATUS_BADGE[data.status].label}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Match" value={data.matchedCount} />
              <Field label="Đã gửi" value={data.enqueuedCount} />
              <Field label="Tạo lúc" value={formatDateTime(data.createdAt)} />
              <Field label="Duyệt lúc" value={formatDateTime(data.approvedAt)} />
              {data.rejectedReason && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Lý do từ chối</div>
                  <div>{data.rejectedReason}</div>
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Snapshot ({snapshot.length} khách hàng)
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>SĐT</TableHead>
                      <TableHead>Biến</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.slice(0, 30).map((s) => (
                      <TableRow key={s.customerId}>
                        <TableCell className="font-mono text-xs">#{s.customerId}</TableCell>
                        <TableCell className="font-mono text-xs">{s.phone}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {JSON.stringify(s.variables)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {snapshot.length > 30 && (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    +{snapshot.length - 30} khách hàng khác…
                  </div>
                )}
              </div>
            </div>
            {canDecide && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="reject-reason">Lý do (dành cho từ chối)</Label>
                <Input
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="VD: Nội dung template chưa duyệt"
                />
              </div>
            )}
          </div>
        ) : null}
        {canDecide && (
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => reject.mutate()}
              disabled={!rejectReason.trim() || reject.isPending}
            >
              <XIcon className="mr-1 h-4 w-4" />
              Từ chối
            </Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              <Check className="mr-1 h-4 w-4" />
              Duyệt & gửi
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? '—'}</div>
    </div>
  );
}
