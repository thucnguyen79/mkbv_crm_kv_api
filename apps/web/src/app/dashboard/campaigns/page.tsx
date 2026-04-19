'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Play, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiClient } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { CampaignFormDialog, type CampaignFormData } from './campaign-form';
import { DryRunDialog } from './dry-run-dialog';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  type: 'ONE_OFF' | 'RECURRING' | 'TRIGGERED';
  ruleCode: string | null;
  conditions: Record<string, unknown>;
  templateId: number | null;
  fallbackTemplateId: number | null;
  allowFallback: boolean;
  schedule: string | null;
  requiresApproval: boolean;
  refreshOnApprove: boolean;
  isActive: boolean;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const canRun = session?.user.role === 'ADMIN' || session?.user.role === 'STAFF';

  const [editing, setEditing] = useState<CampaignFormData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [dryRunFor, setDryRunFor] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () =>
      getApiClient()
        .get<Paginated<Campaign>>('/campaigns', { params: { pageSize: 50 } })
        .then((r) => r.data),
  });

  const run = useMutation({
    mutationFn: (id: number) => getApiClient().post(`/campaigns/${id}/run`),
    onSuccess: (res) => {
      const body = res.data as { status: string; runId: number };
      toast.success(`Run #${body.runId} · ${body.status}`);
      qc.invalidateQueries({ queryKey: ['campaign-runs'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => getApiClient().delete(`/campaigns/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá chiến dịch');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toFormData = (c: Campaign): CampaignFormData => ({
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    type: c.type,
    ruleCode: c.ruleCode ?? 'INACTIVE',
    conditionsJson: JSON.stringify(c.conditions ?? {}, null, 2),
    templateId: c.templateId ?? 0,
    fallbackTemplateId: c.fallbackTemplateId,
    allowFallback: c.allowFallback,
    schedule: c.schedule ?? '',
    requiresApproval: c.requiresApproval,
    refreshOnApprove: c.refreshOnApprove,
    isActive: c.isActive,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chiến dịch</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tạo chiến dịch
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Lịch</TableHead>
              <TableHead>Duyệt</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.ruleCode ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{c.schedule ?? '—'}</TableCell>
                  <TableCell>
                    {c.requiresApproval ? (
                      <Badge variant="warning">Yêu cầu</Badge>
                    ) : (
                      <Badge variant="outline">Tự động</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.isActive ? <Badge variant="success">on</Badge> : <Badge variant="outline">off</Badge>}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDryRunFor(c.id)}>
                      <Eye className="mr-1 h-3 w-3" />
                      Dry-run
                    </Button>
                    {canRun && c.isActive && c.type !== 'TRIGGERED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run.mutate(c.id)}
                        disabled={run.isPending}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Run
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(toFormData(c));
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Xoá chiến dịch "${c.name}"?`)) remove.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CampaignFormDialog open={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
      <DryRunDialog campaignId={dryRunFor} onClose={() => setDryRunFor(null)} />
    </div>
  );
}
